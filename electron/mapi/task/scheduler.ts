/**
 * Task Scheduler — 主进程定时任务调度器
 *
 * 每 30 秒检查一次数据库中的定时任务（run_mode = 'scheduled'），
 * 使用 croner 判断当前时间是否匹配 cron 表达式，匹配则执行任务。
 */

import adbkitPkg from '@devicefarmer/adbkit'
import {Cron} from 'croner'
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {Log} from '../log/index'
import Apps from '../app/index'
import DBMain from '../db/main'
import {AppEnv} from '../env'
import {Events} from '../event/main'
import Pyenv from '../pyenv/main'
import {isPackaged, resolveAdbBin} from '../../lib/env'

const {Adb} = adbkitPkg as any

const _dirname = path.dirname(fileURLToPath(import.meta.url))

interface TaskRow {
    id: number
    uuid?: string
    name: string
    description: string
    code: string
    language: string
    run_mode: string
    cron_expression: string
    device_ids: string
    run_on_all_devices: number
}

const CHECK_INTERVAL_MS = 30_000

// 记录每个定时任务最后触发的分钟标识 "YYYY-MM-DD HH:mm"
const lastTriggeredMinute = new Map<number, string>()

// ── 同一任务的运行闸门（定时 / 手动 / HTTP CLI 共用一条队列）──
// activeRuns 只做同步占位，task_run 记录仍是唯一对外可见的状态来源
const activeRuns = new Map<number, {runId: number | string | null; token: string; startedAt: number}>()
const runQueues = new Map<number, QueuedRunItem[]>()
const runWaiters = new Map<number | string, (result: GateResult) => void>()
const waiterPromises = new Map<number | string, Promise<GateResult>>()

const QUEUED_REASON = '排队中：同一任务正在运行，等上一轮结束后自动执行'
const CANCELLED_REASON = '已取消排队'

type GateResult = {status: 'granted' | 'cancelled'; runId?: number | string}

type QueuedRunItem = {
    kind: 'main' | 'renderer'
    taskId: number
    runId: number | string
    token: string
}

let intervalHandle: ReturnType<typeof setInterval> | null = null

/**
 * 获取当前分钟标识
 */
const currentMinuteKey = (date: Date = new Date()): string => {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    const h = String(date.getHours()).padStart(2, '0')
    const min = String(date.getMinutes()).padStart(2, '0')
    return `${y}-${m}-${d} ${h}:${min}`
}

/**
 * 构建 Python 执行环境
 */
const buildPythonEnv = () => {
    const basePath = isPackaged ? process.resourcesPath : process.env.APP_ROOT || path.resolve(_dirname, '../../..')
    const isWin = process.platform === 'win32'
    const pythonPath = isWin
        ? path.join(basePath, 'env/task/_aienv/Scripts/python.exe')
        : path.join(basePath, 'env/task/_aienv/bin/python')
    const libPath = path.join(basePath, 'env/task/lib')
    return {pythonPath, libPath, taskDir: path.join(basePath, 'env/task')}
}

/**
 * 任务项目化后优先在项目目录内执行入口文件；目录缺失时回退内联代码。
 */
const buildRunCommand = (task: TaskRow) => {
    const {pythonPath, libPath, taskDir} = buildPythonEnv()
    let command = [pythonPath, '-u', '-c', task.code || '']
    let cwd = taskDir
    if (task.uuid) {
        try {
            const projectRoot = path.resolve(AppEnv.dataRoot || '', 'projects', task.uuid)
            let entry = 'main.py'
            const manifestFile = path.join(projectRoot, 'linkandroid.json')
            if (fs.existsSync(manifestFile)) {
                const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'))
                if (manifest && manifest.entry) entry = String(manifest.entry)
            }
            const entryFile = path.resolve(projectRoot, entry)
            if (entryFile.startsWith(projectRoot + path.sep) && fs.existsSync(entryFile)) {
                command = [pythonPath, '-u', entryFile]
                cwd = projectRoot
            }
        } catch (e: any) {
            Log.error('TaskScheduler.projectPathFailed', {taskId: task.id, error: e?.message || String(e)})
        }
    }
    return {command, cwd, libPath, taskDir}
}

/**
 * 设备排序优先级: USB(0) < WiFi(1) < 模拟器(2)
 */
const deviceSortKey = (id: string): number => {
    if (id.startsWith('emulator-')) return 2
    if (id.includes(':')) return 1
    return 0
}

/**
 * 从 adb 发现在线设备 ID 列表, USB 优先.
 * 失败时返回空数组.
 */
const discoverOnlineDevices = async (): Promise<string[]> => {
    let bin: string | null = null
    try {
        bin = resolveAdbBin()
    } catch {
        // fall back to system adb
    }
    const client = Adb.createClient(bin ? {bin} : {})
    try {
        const devices = await client.listDevicesWithPaths()
        return devices
            .filter((d: any) => d.type === 'device' || d.type === 'emulator')
            .map((d: any) => d.id)
            .sort((a: string, b: string) => deviceSortKey(a) - deviceSortKey(b))
    } catch (e) {
        return []
    } finally {
        client.kill().catch(() => {})
    }
}

/**
 * 构建任务运行环境变量, 与前端手动执行 (TaskRuntime) 保持一致.
 */
const buildTaskEnv = (task: {id: number; name: string}, deviceIds: string[]): Record<string, string> => {
    const env: Record<string, string> = {
        LINKANDROID_TASK_ID: `${task.id}`,
        LINKANDROID_TASK_NAME: task.name,
        ...Pyenv.buildEnv(),
    }
    if (deviceIds.length > 0) {
        env.LINKANDROID_DEVICE_ID = deviceIds[0]
        env.LINKANDROID_DEVICE_IDS = deviceIds.join(',')
        env.ANDROID_DEVICE_ADDR = deviceIds[0]
    }
    try {
        env.LINKANDROID_ADB_PATH = resolveAdbBin()
    } catch {
        // adb binary unavailable — skip
    }
    return env
}

/**
 * 解析任务保存的「运行设置」目标设备:
 * - run_on_all_devices = 1 → 所有在线设备
 * - device_ids 非空 → 逗号分隔的设备 ID 列表
 * - 均未配置 → 空数组 (调用方自行兜底)
 */
const parseBoundDevices = async (task: TaskRow): Promise<string[]> => {
    if (task.run_on_all_devices === 1) {
        return await discoverOnlineDevices()
    }
    return (task.device_ids || '')
        .split(',')
        .map((id) => id.trim())
        .filter((id) => id.length > 0)
}

/**
 * 读取任务行（排队出队时重新取，避免用过期数据执行）
 */
const fetchTaskRow = async (taskId: number): Promise<TaskRow | undefined> => {
    return (await DBMain.first(
        `SELECT id, uuid, name, description, code, language, run_mode, cron_expression, device_ids, run_on_all_devices
         FROM task WHERE id = ?`,
        [taskId],
    )) as TaskRow | undefined
}

const createRunRecord = async (task: TaskRow, deviceId: string, status: string, log: string) => {
    const now = new Date().toISOString()
    return await DBMain.insert(
        `INSERT INTO task_run (created_at, updated_at, task_id, device_id, status, log, started_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [now, now, task.id, deviceId || 'scheduler', status, log, null],
    )
}

const markRunStatus = async (runId: number | string, status: string, log: string) => {
    const now = new Date().toISOString()
    await DBMain.update(`UPDATE task_run SET updated_at = ?, status = ?, log = ?, finished_at = ? WHERE id = ?`, [
        now,
        status,
        log,
        now,
        runId,
    ]).catch(() => {})
}

/**
 * 同步占住任务闸门；已占住返回 false
 */
const reserveTask = (taskId: number, token: string): boolean => {
    if (activeRuns.has(taskId)) return false
    activeRuns.set(taskId, {runId: null, token, startedAt: Date.now()})
    return true
}

const releaseTask = (taskId: number, token: string) => {
    const active = activeRuns.get(taskId)
    // 只有持有者能松开闸门，避免重复释放把下一轮的锁删掉
    if (!active || active.token !== token) return
    activeRuns.delete(taskId)
    void pumpTaskQueue(taskId)
}

/**
 * 入队。rank 已存在的排队行直接复用，避免重复记录
 */
const enqueueRun = async (
    task: TaskRow,
    kind: 'main' | 'renderer',
    deviceId: string,
    token: string,
    runId?: number | string,
) => {
    const id = runId ?? (await createRunRecord(task, deviceId, 'pending', QUEUED_REASON))
    const list = runQueues.get(task.id) || []
    list.push({kind, taskId: task.id, runId: id, token})
    runQueues.set(task.id, list)
    return id
}

/**
 * 队列推进：闸门空闲时取队首执行
 * - main：主进程自己跑（定时任务排队 / 重启恢复的排队行）
 * - renderer：唤醒等待中的渲染层，由它自己跑（保证运行环境与手动运行一致）
 */
const pumpTaskQueue = async (taskId: number) => {
    if (activeRuns.has(taskId)) return
    const list = runQueues.get(taskId)
    if (!list || list.length === 0) {
        runQueues.delete(taskId)
        return
    }
    const item = list.shift() as QueuedRunItem
    if (list.length === 0) runQueues.delete(taskId)

    if (item.kind === 'renderer') {
        const waiter = runWaiters.get(item.runId)
        runWaiters.delete(item.runId)
        if (!waiter) {
            // 渲染层已不在等待（窗口关闭或已取消），跳过这条继续排下一条
            waiterPromises.delete(item.runId)
            await markRunStatus(item.runId, 'failed', CANCELLED_REASON)
            await pumpTaskQueue(taskId)
            return
        }
        activeRuns.set(taskId, {runId: item.runId, token: item.token, startedAt: Date.now()})
        waiter({status: 'granted', runId: item.runId})
        return
    }

    const task = await fetchTaskRow(taskId)
    if (!task) {
        await markRunStatus(item.runId, 'failed', '任务已删除')
        await pumpTaskQueue(taskId)
        return
    }
    activeRuns.set(taskId, {runId: item.runId, token: item.token, startedAt: Date.now()})
    await executeScheduledRun(task, item.runId).catch((e) => {
        Log.error('TaskScheduler.pumpError', {taskId, error: e?.message || String(e)})
    })
}

/**
 * 执行单个定时任务
 */
const executeScheduledRun = async (task: TaskRow, runId: number | string) => {
    const now = new Date().toISOString()
    let deviceIds: string[] = []
    let logOutput = ''
    const active = activeRuns.get(task.id)
    if (active) {
        active.runId = runId
    } else {
        activeRuns.set(task.id, {runId, token: `main-${runId}`, startedAt: Date.now()})
    }

    try {
        // 定时任务优先使用任务保存的「运行设置」设备, 未配置则自动发现
        const boundDevices = await parseBoundDevices(task)
        deviceIds = boundDevices.length > 0 ? boundDevices : await discoverOnlineDevices()

        // 更新为 running
        await DBMain.update(
            `UPDATE task_run SET updated_at = ?, status = ?, device_id = ?, started_at = ? WHERE id = ?`,
            [now, 'running', deviceIds.join(',') || 'scheduler', now, runId],
        )

        const {command, cwd} = buildRunCommand(task)

        const controller = await Apps.spawnShell(command, {
            shell: false,
            cwd,
            // A Python exception exits with 1; never inherit the Windows rule
            // that treats exit code 1 as success, otherwise failures are silent
            successExitCodes: [0],
            stdout: (data: string) => {
                logOutput += data
            },
            stderr: (data: string) => {
                logOutput += data
            },
            env: buildTaskEnv(task, deviceIds),
        })

        const result = await controller.result()
        logOutput = result || logOutput

        const finishedAt = new Date().toISOString()
        await DBMain.update(`UPDATE task_run SET updated_at = ?, status = ?, log = ?, finished_at = ? WHERE id = ?`, [
            finishedAt,
            'success',
            logOutput,
            finishedAt,
            runId,
        ])

        Log.info('TaskScheduler.executeSuccess', {taskId: task.id, taskName: task.name})
    } catch (e: any) {
        const errMsg = e?.message || String(e)
        const failureLog = [logOutput, errMsg].filter((item) => !!String(item || '').trim()).join('\n')
        const finishedAt = new Date().toISOString()
        if (runId) {
            await DBMain.update(
                `UPDATE task_run SET updated_at = ?, status = ?, log = ?, finished_at = ? WHERE id = ?`,
                [finishedAt, 'failed', failureLog, finishedAt, runId],
            ).catch(() => {})
        }
        Log.error('TaskScheduler.executeFailed', {taskId: task.id, taskName: task.name, error: errMsg})
        // 定时任务失败后交给渲染层弹出修复会话（弹窗展示失败日志并自动修复、重跑）
        try {
            Events.broadcast(
                'TaskScheduledFailed',
                {
                    taskId: task.id,
                    runId,
                    deviceId: deviceIds[0] || '',
                    deviceIds,
                    log: failureLog,
                },
                {limit: true, scopes: ['main']},
            )
        } catch (broadcastError: any) {
            Log.error('TaskScheduler.broadcastFailed', {
                taskId: task.id,
                error: broadcastError?.message || broadcastError,
            })
        }
    } finally {
        const token = activeRuns.get(task.id)?.token || `main-${runId}`
        releaseTask(task.id, token)
    }
}

/**
 * 执行一次调度检查
 */
const doSchedulerTick = async () => {
    try {
        const tasks: TaskRow[] = await DBMain.select(
            `SELECT id, uuid, name, description, code, language, run_mode, cron_expression, device_ids, run_on_all_devices
             FROM task
             WHERE run_mode = 'scheduled' AND cron_expression != ''`,
        )

        const now = new Date()
        const nowMinuteKey = currentMinuteKey(now)
        // croner 的 match() 按秒级判断，5 段表达式要求秒=0；调度器每 30 秒扫描一次，
        // 直接用当前时间会永远不命中。这里对齐到分钟边界，同一分钟由 lastTriggeredMinute 去重。
        const matchAt = new Date(now)
        matchAt.setSeconds(0, 0)

        for (const task of tasks) {
            try {
                // 检查该分钟是否已触发过
                if (lastTriggeredMinute.get(task.id) === nowMinuteKey) {
                    continue
                }

                const job = new Cron(task.cron_expression)
                if (!job.match(matchAt)) {
                    continue
                }

                // 触发时刻就记下分钟标识，避免长时间运行的任务跨分钟后被重复触发
                lastTriggeredMinute.set(task.id, nowMinuteKey)

                const token = `cron-${task.id}-${Date.now()}`
                if (!reserveTask(task.id, token)) {
                    // 同一任务还在跑：排队，并在运行记录里写明原因。
                    // 已有待跑的定时排队项时不再叠加，避免长任务把队列撑爆
                    const waiting = (runQueues.get(task.id) || []).filter((item) => item.kind === 'main').length
                    if (waiting === 0) {
                        await enqueueRun(task, 'main', 'scheduler', token)
                    }
                    continue
                }

                try {
                    const runId = await createRunRecord(task, 'scheduler', 'pending', '')
                    // 异步执行，不阻塞后续任务检查
                    executeScheduledRun(task, runId).catch((e) => {
                        Log.error('TaskScheduler.executeError', {
                            taskId: task.id,
                            taskName: task.name,
                            error: e?.message || String(e),
                        })
                    })
                } catch (e: any) {
                    releaseTask(task.id, token)
                    Log.error('TaskScheduler.queueFailed', {
                        taskId: task.id,
                        error: e?.message || String(e),
                    })
                }
            } catch (e: any) {
                Log.error('TaskScheduler.checkError', {
                    taskId: task.id,
                    error: e?.message || String(e),
                })
            }
        }
    } catch (e: any) {
        Log.error('TaskScheduler.tickError', {error: e?.message || String(e)})
    }
}

/**
 * 根据任务 ID 手动执行任务（供 HTTP API / CLI 调用）
 *
 * 设备解析优先级: deviceIds > deviceId > 任务保存的运行设置 > 自动发现 adb 在线设备 (USB 优先)
 *
 * @param deviceId  可选, 指定目标设备
 * @param deviceIds 可选, 多设备列表; 优先级高于 deviceId
 */
export const runTaskById = async (
    taskId: number,
    deviceId?: string,
    deviceIds?: string[],
): Promise<{runId: number | string | null; success: boolean; log: string}> => {
    const task: TaskRow | undefined = await DBMain.first(
        `SELECT id, uuid, name, description, code, language, run_mode, cron_expression, device_ids, run_on_all_devices
         FROM task WHERE id = ?`,
        [taskId],
    )
    if (!task) {
        return {runId: null, success: false, log: 'TaskNotFound'}
    }
    let runId: number | string | null = null
    let logOutput = ''
    const token = `api-${taskId}-${Date.now()}`
    if (!reserveTask(taskId, token)) {
        // 同一任务正在运行：立即返回，调用方自己决定是否重试
        return {runId: null, success: false, log: 'TaskAlreadyRunning'}
    }
    try {
        // 解析目标设备: 显式指定 > 任务绑定 > 自动发现
        let targetIds: string[] = []
        if (deviceIds && deviceIds.length > 0) {
            targetIds = deviceIds
        } else if (deviceId) {
            targetIds = [deviceId]
        } else {
            targetIds = await parseBoundDevices(task)
            if (targetIds.length === 0) {
                targetIds = await discoverOnlineDevices()
            }
        }
        if (targetIds.length === 0) {
            throw new Error('NoOnlineDevice')
        }
        const now = new Date().toISOString()
        runId = await DBMain.insert(
            `INSERT INTO task_run (created_at, updated_at, task_id, device_id, status, log, started_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [now, now, task.id, targetIds.join(','), 'pending', '', null],
        )
        await DBMain.update(`UPDATE task_run SET updated_at = ?, status = ?, started_at = ? WHERE id = ?`, [
            now,
            'running',
            now,
            runId,
        ])
        const {command, cwd} = buildRunCommand(task)
        const controller = await Apps.spawnShell(command, {
            shell: false,
            cwd,
            // A Python exception exits with 1; never inherit the Windows rule
            // that treats exit code 1 as success, otherwise failures are silent
            successExitCodes: [0],
            stdout: (data: string) => {
                logOutput += data
            },
            stderr: (data: string) => {
                logOutput += data
            },
            env: buildTaskEnv(task, targetIds),
        })
        const result = await controller.result()
        logOutput = result || logOutput
        const finishedAt = new Date().toISOString()
        await DBMain.update(`UPDATE task_run SET updated_at = ?, status = ?, log = ?, finished_at = ? WHERE id = ?`, [
            finishedAt,
            'success',
            logOutput,
            finishedAt,
            runId,
        ])
        Log.info('Task.runTaskById.success', {taskId, taskName: task.name})
        return {runId, success: true, log: logOutput}
    } catch (e: any) {
        const errMsg = e?.message || String(e)
        const finishedAt = new Date().toISOString()
        if (runId) {
            await DBMain.update(
                `UPDATE task_run SET updated_at = ?, status = ?, log = ?, finished_at = ? WHERE id = ?`,
                [finishedAt, 'failed', errMsg, finishedAt, runId],
            ).catch(() => {})
        }
        Log.error('Task.runTaskById.failed', {taskId, error: errMsg})
        return {runId, success: false, log: errMsg}
    } finally {
        releaseTask(taskId, token)
    }
}

/**
 * 渲染层手动运行前的占位（与定时任务共用同一把闸门）
 * - granted：已占位，调用方自行执行，结束后必须 releaseRun
 * - queued：已排队并写入一条「等待中」记录，调用方用 waitRunGranted 等轮到自己
 */
export const acquireRun = async (
    taskId: number,
    deviceIds: string[] = [],
    token: string = '',
): Promise<{status: 'granted' | 'queued'; runId?: number | string; position?: number}> => {
    const useToken = token || `manual-${taskId}-${Date.now()}`
    if (reserveTask(taskId, useToken)) {
        return {status: 'granted'}
    }
    const task = await fetchTaskRow(taskId)
    if (!task) {
        // 任务已不存在（被删除），放行让调用方自己报错
        return {status: 'granted'}
    }
    const runId = await enqueueRun(task, 'renderer', deviceIds.join(','), useToken)
    // 等待者先登记，避免出队那一瞬间找不到人而误判为取消
    waiterPromises.set(
        runId,
        new Promise<GateResult>((resolve) => {
            runWaiters.set(runId, resolve)
        }),
    )
    const list = runQueues.get(taskId) || []
    return {status: 'queued', runId, position: list.length}
}

/**
 * 等待排到自己；取消排队时会返回 cancelled
 */
export const waitRunGranted = async (runId: number | string): Promise<GateResult> => {
    const promise = waiterPromises.get(runId)
    if (!promise) {
        return {status: 'cancelled', runId}
    }
    const result = await promise
    waiterPromises.delete(runId)
    return result
}

/**
 * 取消排队（运行记录里删掉等待中的那条也走这里）
 */
export const cancelQueuedRun = async (runId: number | string): Promise<boolean> => {
    for (const [taskId, items] of runQueues) {
        const index = items.findIndex((item) => item.runId === runId)
        if (index < 0) continue
        items.splice(index, 1)
        if (items.length === 0) runQueues.delete(taskId)
        runWaiters.get(runId)?.({status: 'cancelled', runId})
        runWaiters.delete(runId)
        waiterPromises.delete(runId)
        await markRunStatus(runId, 'failed', CANCELLED_REASON)
        return true
    }
    return false
}

/**
 * 手动运行结束后松开闸门（token 不匹配时忽略，防止重复释放）
 */
export const releaseRun = (taskId: number, token: string) => {
    releaseTask(taskId, token)
}

/**
 * 获取指定任务的下次执行时间
 */
export const getNextRunTime = (cronExpression: string): string | null => {
    if (!cronExpression) return null
    try {
        const job = new Cron(cronExpression)
        const next = job.nextRun()
        return next ? next.toISOString() : null
    } catch {
        return null
    }
}

/**
 * 获取所有定时任务的调度状态
 */
export const getSchedulerStatus = async (): Promise<
    Array<{
        id: number
        name: string
        cronExpression: string
        nextRun: string | null
        lastTriggeredAt: string | null
    }>
> => {
    const tasks: TaskRow[] = await DBMain.select(
        `SELECT id, name, cron_expression FROM task WHERE run_mode = 'scheduled' AND cron_expression != ''`,
    )
    return tasks.map((t) => {
        const lastKey = lastTriggeredMinute.get(t.id)
        const lastTriggeredAt = lastKey ? `${lastKey}:00Z` : null
        return {
            id: t.id,
            name: t.name,
            cronExpression: t.cron_expression,
            nextRun: getNextRunTime(t.cron_expression),
            lastTriggeredAt,
        }
    })
}

/**
 * 重置某任务的触发状态（用于测试/手动更新后）
 */
export const resetTaskTrigger = (taskId: number) => {
    lastTriggeredMinute.delete(taskId)
}

/**
 * 上次异常退出遗留的「运行中」记录标失败，否则重启后闸门会被永远占住
 */
const resetStaleRuns = async () => {
    const appStartedAt = new Date(Date.now() - process.uptime() * 1000).toISOString()
    const now = new Date().toISOString()
    try {
        await DBMain.update(
            `UPDATE task_run SET updated_at = ?, status = ?, log = ?, finished_at = ?
             WHERE status = 'running' AND created_at < ?`,
            [now, 'failed', '应用未正常退出，运行状态已重置', now, appStartedAt],
        )
    } catch (e: any) {
        Log.error('TaskScheduler.resetStaleFailed', {error: e?.message || String(e)})
    }
}

/**
 * 重启后把「等待中」的记录重新排进队列（按记录先后顺序）
 */
const restoreQueuedRuns = async () => {
    try {
        const rows: Array<{id: number | string; task_id: number}> = await DBMain.select(
            `SELECT id, task_id FROM task_run WHERE status = 'pending' ORDER BY id ASC`,
        )
        for (const row of rows || []) {
            const list = runQueues.get(row.task_id) || []
            list.push({kind: 'main', taskId: row.task_id, runId: row.id, token: `restored-${row.id}`})
            runQueues.set(row.task_id, list)
        }
        for (const taskId of [...runQueues.keys()]) {
            void pumpTaskQueue(taskId)
        }
    } catch (e: any) {
        Log.error('TaskScheduler.restoreQueuedFailed', {error: e?.message || String(e)})
    }
}

/**
 * 启动调度器
 */
export const start = () => {
    if (intervalHandle) return
    Log.info('TaskScheduler.start', {})
    void resetStaleRuns()
        .then(() => restoreQueuedRuns())
        .then(() => doSchedulerTick())
    intervalHandle = setInterval(doSchedulerTick, CHECK_INTERVAL_MS)
}

/**
 * 停止调度器
 */
export const stop = () => {
    if (intervalHandle) {
        clearInterval(intervalHandle)
        intervalHandle = null
    }
    lastTriggeredMinute.clear()
    // 停调度时把还在等待的手动运行放掉，避免渲染层一直挂着
    for (const [runId, resolve] of runWaiters) {
        resolve({status: 'cancelled', runId})
    }
    runWaiters.clear()
    waiterPromises.clear()
    runQueues.clear()
    Log.info('TaskScheduler.stop', {})
}

/**
 * 调度器是否正在运行
 */
export const isRunning = (): boolean => {
    return intervalHandle !== null
}
