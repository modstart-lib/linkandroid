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
        throw new Error(result.error || 'Python 环境未就绪，无法刷新 AI 手机预览')
    }
    const taskDir = await taskPath('')
    const pythonPath =
        window.$mapi.app.platformName() === 'win'
            ? await taskPath('_aienv/Scripts/python.exe')
            : await taskPath('_aienv/bin/python')
    const libPath = await taskPath('lib')
    const adbPath = await window.$mapi.adb.getBinPath()
    const targetDeviceIds = deviceIds && deviceIds.length > 0 ? deviceIds : [deviceId]
    return {
        taskDir,
        pythonPath,
        env: {
            LINKANDROID_ADB_PATH: adbPath,
            LINKANDROID_DEVICE_ID: deviceId,
            LINKANDROID_DEVICE_IDS: targetDeviceIds.join(','),
            ANDROID_DEVICE_ADDR: deviceId,
            PYTHONPATH: libPath,
        },
    }
}

export const runTaskPythonCode = async (
    code: string,
    deviceId: string,
    option?: {
        stdout?: (data: string, process: any) => void
        stderr?: (data: string, process: any) => void
        success?: (process: any) => void
        error?: (msg: string, exitCode: number, process: any) => void
        env?: Record<string, any>
        deviceIds?: string[]
    },
) => {
    const runtime = await getTaskRuntime(deviceId, option?.deviceIds)
    const llmEnv = await getLlmEnv()
    return await window.$mapi.app.spawnShell([runtime.pythonPath, '-c', code], {
        shell: false,
        cwd: runtime.taskDir,
        stdout: option?.stdout,
        stderr: option?.stderr,
        success: option?.success,
        error: option?.error,
        env: {
            ...runtime.env,
            ...llmEnv,
            ...(option?.env || {}),
        },
    })
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
