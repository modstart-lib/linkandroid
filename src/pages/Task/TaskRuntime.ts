import {t} from '../../lang'
import {ModelProvider} from '../../module/Model/provider/provider'
import {model} from '../../module/Model/store/model'

const taskPath = async (path: string) => {
    return await window.$mapi.app.resourcePathResolve(`env/task/${path}`)
}

const getLlmEnv = async (): Promise<Record<string, string>> => {
    try {
        await model.init()
        for (const provider of model.providers) {
            if (!provider.data.enabled) continue
            for (const m of provider.data.models) {
                if (!m.enabled) continue
                const apiUrl = ModelProvider.apiUrl(provider.type, provider.apiUrl, provider.data.apiHost)
                return {
                    LINKANDROID_LLM_ENABLED: '1',
                    LINKANDROID_LLM_TYPE: provider.type,
                    LINKANDROID_LLM_API_URL: apiUrl,
                    LINKANDROID_LLM_API_KEY: provider.data.apiKey,
                    LINKANDROID_LLM_MODEL: m.id,
                }
            }
        }
    } catch {
        // LLM not configured — skip silently
    }
    return {}
}

export const getTaskRuntime = async (deviceId: string, deviceIds?: string[]) => {
    // Ensure _aienv Python virtual environment exists before using it
    const result = await window.$mapi.app.ensureAienv()
    if (!result.ok) {
        throw new Error(result.error || t('error.pythonEnvNotReady'))
    }
    const taskDir = await taskPath('')
    const pythonPath =
        window.$mapi.app.platformName() === 'win'
            ? await taskPath('_aienv/Scripts/python.exe')
            : await taskPath('_aienv/bin/python')
    const adbPath = await window.$mapi.adb.getBinPath()
    const targetDeviceIds = deviceIds && deviceIds.length > 0 ? deviceIds : [deviceId]
    // Built-in la lib + the user's pip overlay, assembled by the main process.
    const pyenvEnv = await window.$mapi.pyenv.taskEnv()
    return {
        taskDir,
        pythonPath,
        env: {
            ...pyenvEnv,
            LINKANDROID_ADB_PATH: adbPath,
            LINKANDROID_DEVICE_ID: deviceId,
            LINKANDROID_DEVICE_IDS: targetDeviceIds.join(','),
            ANDROID_DEVICE_ADDR: deviceId,
        },
    }
}

/**
 * Pip packages the task declares in linkandroid.json that are not installed yet.
 * Runs before every start so a shared/imported task tells the user what to install
 * instead of failing halfway with ModuleNotFoundError.
 */
export const taskMissingDependencies = async (projectId?: number): Promise<string[]> => {
    if (!projectId) return []
    try {
        const manifest = await window.$mapi.project.manifest(projectId)
        const dependencies: string[] = manifest?.dependencies || []
        if (!dependencies.length) return []
        return await window.$mapi.pyenv.check(dependencies)
    } catch {
        return []
    }
}

export const runTaskPythonCode = async (
    code: string,
    deviceId: string,
    option?: {
        preparing?: () => void
        started?: () => void
        stdout?: (data: string, process: any) => void
        stderr?: (data: string, process: any) => void
        success?: (process: any) => void
        stopped?: (exitCode: number) => void
        error?: (msg: string, exitCode: number, process: any) => void
        env?: Record<string, any>
        deviceIds?: string[]
        projectId?: number
    },
) => {
    option?.preparing?.()
    const missing = await taskMissingDependencies(option?.projectId)
    if (missing.length) {
        const message = `${t('task.depsMissing')}${missing.join('、')}`
        option?.error?.(message, -1, null)
        return {
            stop: () => {},
            send: () => {},
            result: async (): Promise<string> => {
                throw new Error(message)
            },
        }
    }
    const runtime = await getTaskRuntime(deviceId, option?.deviceIds)
    const llmEnv = await getLlmEnv()
    option?.started?.()
    // Tasks run from their project directory so sibling files can be imported.
    let command = [runtime.pythonPath, '-u', '-c', code]
    let cwd = runtime.taskDir
    if (option?.projectId) {
        try {
            const info = await window.$mapi.project.pathInfo(option.projectId)
            if (info.exists && info.dir) {
                command = [runtime.pythonPath, '-u', `${info.dir}/${info.entry}`]
                cwd = info.dir
            }
        } catch {
            // fall back to inline code
        }
    }
    let stopped = false
    const controller = await window.$mapi.app.spawnShell(command, {
        shell: false,
        cwd,
        // A Python exception exits with 1; do not inherit the Windows rule that
        // treats exit code 1 as success, or a broken task reports success
        successExitCodes: [0],
        stdout: option?.stdout,
        stderr: option?.stderr,
        success: option?.success,
        error: (msg: string, exitCode: number, process: any) => {
            // A user-initiated stop also ends non-zero; report it as stopped so
            // it is never mistaken for a failure that triggers auto repair
            if (stopped) {
                option?.stopped?.(exitCode)
                return
            }
            option?.error?.(msg, exitCode, process)
        },
        env: {
            ...runtime.env,
            ...llmEnv,
            PYTHONUNBUFFERED: '1',
            ...(option?.env || {}),
        },
    })
    return {
        ...controller,
        stop: () => {
            stopped = true
            controller.stop()
        },
    }
}

export const collectDeviceXmlByLa = async (deviceId: string) => {
    const controller = await runTaskPythonCode(
        ['import sys', 'import la', 'la.connect()', 'sys.stdout.write(la.dumpHierarchy())'].join('\n'),
        deviceId,
    )
    return await controller.result()
}

export const collectDeviceScreenshotByLa = async (deviceId: string) => {
    const code = [
        'import base64',
        'import sys',
        'import tempfile',
        'import la',
        'la.connect()',
        'path = tempfile.mktemp(suffix=".png")',
        'sys.stdout.write(base64.b64encode(la.screenshot(path)).decode())',
    ].join('\n')
    const controller = await runTaskPythonCode(code, deviceId)
    return await controller.result()
}
