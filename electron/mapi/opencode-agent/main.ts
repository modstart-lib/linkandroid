/**
 * Main-process bridge to the OpenCode agent worker.
 * The worker owns the SDK host; this module only handles lifecycle and IPC.
 */
import {ipcMain, utilityProcess, type UtilityProcess} from 'electron'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {AppEnv} from '../env'
import Pyenv from '../pyenv/main'
import {resolveAdbBin} from '../../lib/env'
import Log from '../log/main'

type Pending = {
    resolve: (value: any) => void
    reject: (error: Error) => void
    timer: NodeJS.Timeout
    sender?: Electron.WebContents
    clientId?: string
}

const WORKER_IDLE_MS = 5 * 60 * 1000
const WORKER_TIMEOUT_MS = 600 * 1000

/**
 * The worker enforces its own idle / per-turn limits; this IPC timer is only the
 * outer safety net and must not cut a long task that is still making progress.
 */
const workerTimeoutFor = (payload: any) => {
    const requestMs = Number(payload?.timeoutMs || 0)
    return Math.max(WORKER_TIMEOUT_MS, requestMs + 120 * 1000)
}

let worker: UtilityProcess | null = null
let sequence = 0
let idleTimer: NodeJS.Timeout | null = null
const pending = new Map<string, Pending>()

const agentRoot = () => path.join(AppEnv.dataRoot || process.cwd(), 'opencode-agent')

const TASK_BUSINESSES = new Set(['task-chat', 'task-repair'])
const TASK_UUID_RE = /^[a-zA-Z0-9][a-zA-Z0-9_-]{7,63}$/

/**
 * Task AI always works in the task's own project directory (`projects/<uuid>`),
 * so every session of the same task shares a fixed directory. Drafts without a
 * uuid have none, and the worker falls back to a random one.
 */
const taskProjectDirectory = (payload: any) => {
    const business = String(payload?.business || '')
    const uuid = String(payload?.businessId || '').trim()
    if (!TASK_BUSINESSES.has(business) || !TASK_UUID_RE.test(uuid)) return ''
    return path.join(AppEnv.dataRoot || process.cwd(), 'projects', uuid)
}

const workerEntry = () => path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'agent', 'worker.cjs')

/** Python runtime used by the agent's real-device exploration tools. */
const deviceRuntime = () => {
    const basePath =
        process.env.IS_PACKAGED === 'true'
            ? process.resourcesPath
            : AppEnv.appRoot || process.env.APP_ROOT || process.cwd()
    const isWin = process.platform === 'win32'
    let adbPath = ''
    try {
        adbPath = resolveAdbBin()
    } catch {}
    const runtime = {
        pythonPath: isWin
            ? path.join(basePath, 'env/task/_aienv/Scripts/python.exe')
            : path.join(basePath, 'env/task/_aienv/bin/python'),
        libPath: path.join(basePath, 'env/task/lib'),
        taskDir: path.join(basePath, 'env/task'),
        adbPath,
        // la lib + user pip overlay; same assembly as task runs
        pythonEnv: Pyenv.buildEnv(),
    }
    Log.info('OpenCodeAgent.DeviceRuntime', runtime)
    return runtime
}

const prepareDirs = (root: string) => {
    const home = path.join(root, 'home')
    const config = path.join(home, '.config')
    const env: Record<string, string> = {
        HOME: home,
        XDG_CONFIG_HOME: config,
        XDG_DATA_HOME: path.join(home, '.local', 'share'),
        XDG_STATE_HOME: path.join(home, '.local', 'state'),
        XDG_CACHE_HOME: path.join(home, '.cache'),
        // The worker HOME is isolated, so prompts get the real desktop this way.
        LINKANDROID_HOME: os.homedir(),
    }
    // Windows ignores HOME for os.homedir() (it reads USERPROFILE), so the global
    // home would stay on the real profile and pick up the user's OpenCode
    // settings. OPENCODE_TEST_HOME overrides only the SDK's global home; changing
    // USERPROFILE would break adb keys and the bundled Python runtime.
    if (process.platform === 'win32') {
        env.OPENCODE_TEST_HOME = home
    }
    for (const dir of [
        root,
        home,
        path.join(config, 'opencode'),
        env.XDG_DATA_HOME,
        env.XDG_STATE_HOME,
        env.XDG_CACHE_HOME,
        path.join(root, 'workspace'),
        path.join(root, 'requests'),
        path.join(root, 'db'),
    ]) {
        fs.mkdirSync(dir, {recursive: true})
    }
    const configFile = path.join(config, 'opencode', 'opencode.json')
    ensureAgentPermissions(configFile)
    return env
}

/**
 * Local file and shell tools are part of every agent profile, and the agent
 * host has no UI to answer permission prompts, so they are allowed by default.
 * Values already present in the file win.
 */
const AGENT_PERMISSION: Record<string, 'allow' | 'deny'> = {
    edit: 'allow',
    read: 'allow',
    shell: 'allow',
    glob: 'allow',
    grep: 'allow',
    external_directory: 'allow',
    subagent: 'deny',
    question: 'deny',
}

const ensureAgentPermissions = (configFile: string) => {
    let config: Record<string, any> = {}
    try {
        config = JSON.parse(fs.readFileSync(configFile, 'utf8')) || {}
    } catch {}
    const permission = config.permission && typeof config.permission === 'object' ? config.permission : {}
    config.$schema = config.$schema || 'https://opencode.ai/config.json'
    config.permission = {...AGENT_PERMISSION, ...permission}
    fs.writeFileSync(configFile, JSON.stringify(config, null, 2))
}

const rejectPending = (message: string) => {
    for (const item of Array.from(pending.values())) {
        clearTimeout(item.timer)
        item.reject(new Error(message))
    }
    pending.clear()
}

const ensureWorker = () => {
    if (worker) return worker
    const root = agentRoot()
    const env = prepareDirs(root)
    const child = utilityProcess.fork(workerEntry(), [], {
        serviceName: 'linkandroid-opencode-agent',
        env: {...process.env, ...env},
    })
    child.on('message', (message: any) => {
        if (message?.progress) {
            const progressItem = pending.get(message.id)
            if (progressItem?.sender) {
                progressItem.sender.send('opencodeAgent:progress', {
                    clientId: progressItem.clientId,
                    messages: message.progress,
                })
            }
            return
        }
        const item = pending.get(message?.id)
        if (!item) return
        clearTimeout(item.timer)
        pending.delete(message.id)
        if (message.ok) {
            item.resolve(message.result)
        } else {
            item.reject(new Error(message.error || 'OpenCode agent failed'))
        }
    })
    child.on('exit', (code) => {
        Log.info('OpenCodeAgent.WorkerExit', {code})
        if (worker === child) worker = null
        rejectPending(`OpenCode agent worker exited (${code})`)
    })
    child.stdout?.on('data', (data) => Log.info('OpenCodeAgent.Stdout', String(data).trim()))
    child.stderr?.on('data', (data) => Log.error('OpenCodeAgent.Stderr', String(data).trim()))
    worker = child
    return child
}

const scheduleIdle = () => {
    if (idleTimer) clearTimeout(idleTimer)
    idleTimer = setTimeout(() => {
        idleTimer = null
        if (worker) {
            Log.info('OpenCodeAgent.IdleExit')
            worker.kill()
            worker = null
        }
    }, WORKER_IDLE_MS)
    idleTimer.unref?.()
}

const request = async (
    kind:
        | 'runTaskAgent'
        | 'runChatAgent'
        | 'generateText'
        | 'sessionRemove'
        | 'sessionRemoveBusiness'
        | 'sessionList'
        | 'sessionContext'
        | 'sessionPrune'
        | 'interrupt',
    payload: any,
    sender?: Electron.WebContents,
) => {
    // 新请求开始前取消上一个请求结束后的空闲退出计时，避免长请求中途被回收
    if (idleTimer) {
        clearTimeout(idleTimer)
        idleTimer = null
    }
    const child = ensureWorker()
    const id = `agent_${Date.now()}_${++sequence}`
    const startedAt = Date.now()
    try {
        const result = await new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                pending.delete(id)
                reject(new Error('OpenCode agent timeout'))
            }, workerTimeoutFor(payload))
            pending.set(id, {resolve, reject, timer, sender, clientId: payload?.clientId})
            // `dataRoot` is a main-process concern: the worker cannot resolve it on its own,
            // and both runTaskAgent / generateText create their per-request DB under it.
            child.postMessage({
                id,
                kind,
                payload: {
                    ...payload,
                    dataRoot: AppEnv.dataRoot || process.cwd(),
                    // Task AI uses the task's fixed project directory; everything else gets a random one.
                    directory: taskProjectDirectory(payload),
                    ...(payload?.deviceId || payload?.devices?.length ? {deviceRuntime: deviceRuntime()} : {}),
                },
            })
        })
        Log.info('OpenCodeAgent.Request', {kind, duration: Date.now() - startedAt})
        return result
    } catch (error: any) {
        Log.error('OpenCodeAgent.RequestFailed', {
            kind,
            duration: Date.now() - startedAt,
            message: String(error?.message || error),
        })
        throw error
    } finally {
        scheduleIdle()
    }
}

export const OpenCodeAgent = {
    /** Stop the model turn that is currently running (out-of-band, not queued). */
    interrupt(payload: {clientId?: string} = {}) {
        return request('interrupt', payload)
    },
    /** Remove all OpenCode sessions owned by one business record (e.g. a deleted task). */
    sessionRemoveBusiness(business: string[], businessId: string) {
        return request('sessionRemoveBusiness', {business, businessId})
    },
    sessionRemove(opencodeSessionId: string) {
        return request('sessionRemove', {opencodeSessionId})
    },
    sessionList(payload: {business?: string; businessId?: string}) {
        return request('sessionList', payload)
    },
    /** Orphan cleanup: remove sessions whose business record no longer exists. */
    pruneSessions(input: {businesses: string[]; validIds: string[]; validOpenCodeIds: string[]; keepGenerate: number}) {
        return request('sessionPrune', input)
    },
    register() {
        ipcMain.handle('opencodeAgent:runTaskAgent', async (event, input) =>
            request('runTaskAgent', input, event.sender),
        )
        ipcMain.handle('opencodeAgent:runChatAgent', async (event, input) =>
            request('runChatAgent', input, event.sender),
        )
        ipcMain.handle('opencodeAgent:interrupt', async (event, input) => request('interrupt', input))
        ipcMain.handle('opencodeAgent:generateText', async (event, input) =>
            request('generateText', input, event.sender),
        )
        ipcMain.handle('opencodeAgent:sessionRemove', async (event, input) =>
            request('sessionRemove', input, event.sender),
        )
        ipcMain.handle('opencodeAgent:sessionRemoveBusiness', async (event, input) =>
            request('sessionRemoveBusiness', input, event.sender),
        )
        ipcMain.handle('opencodeAgent:sessionList', async (event, input) => request('sessionList', input, event.sender))
        ipcMain.handle('opencodeAgent:sessionContext', async (event, input) =>
            request('sessionContext', input, event.sender),
        )
    },
    destroy() {
        if (idleTimer) clearTimeout(idleTimer)
        idleTimer = null
        rejectPending('OpenCode agent destroyed')
        if (worker) {
            worker.kill()
            worker = null
        }
    },
}

export default OpenCodeAgent
