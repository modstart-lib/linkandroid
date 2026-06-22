import {devProResolve, extraResolveBin, extraResolveWithPlatform, isDev, isWin, resolveAdbBin} from '../../lib/env'
import {Apps} from '../app'
import {Log} from '../log'

const getBinPath = async (): Promise<string> => {
    // Dev mode: try pro project scrcpy binary first
    const proBinary = devProResolve('x/app/scrcpy')
    if (proBinary) return proBinary
    return extraResolveBin('scrcpy/scrcpy')
}

const spawnShell = async (
    args: string[],
    option: {
        stdout?: (data: string, process: any) => void
        stderr?: (data: string, process: any) => void
        success?: (process: any) => void
        error?: (msg: string, exitCode: number, process: any) => void
        cwd?: string
        outputEncoding?: string
        env?: Record<string, any>
    } | null = null,
) => {
    option = Object.assign(
        {
            env: {},
            args: [],
        },
        option,
    )

    // Resolve binary path
    let binary: string

    if (isDev) {
        const proBinary = devProResolve('x/app/scrcpy')
        if (proBinary) binary = proBinary
    }
    if (!binary) {
        binary = await getBinPath()
    }
    option.env['ADB'] = resolveAdbBin()
    option.env['SCRCPY_FONT_PATH'] = extraResolveWithPlatform('scrcpy/font.ttf')
    option.env['SCRCPY_ICON_ROOT_PATH'] = extraResolveWithPlatform('scrcpy')

    // Resolve SCRCPY_SERVER_PATH: try pro project first in dev mode
    option.env['SCRCPY_SERVER_PATH'] =
        devProResolve('x/server/scrcpy-server') || extraResolveWithPlatform('scrcpy/scrcpy-server')

    if (isWin) {
        // option.env["ADB"] = IconvUtil.convert(option.env["ADB"], "gbk");
    }

    Log.info('Scrcpy.spawnShell', [binary, ...args].join(' '))
    return await Apps.spawnShell([binary, ...args], {
        ...option,
        shell: false,
    })
}

const mirror = async (
    serial: string,
    option: {
        title?: string
        args?: string[]
        stdout?: (data: string, process: any) => void
        stderr?: (data: string, process: any) => void
        success?: (process: any) => void
        error?: (msg: string, exitCode: number, process: any) => void
        env?: Record<string, any>
    },
) => {
    option = Object.assign(
        {
            env: {},
            args: [],
        },
        option,
    )
    const args = ['--serial', serial, '--window-title', option.title || 'LinkAndroid', ...option.args]
    return spawnShell(args, {
        stdout: option.stdout,
        stderr: option.stderr,
        success: option.success,
        error: option.error,
        env: option.env,
    })
}

export default {
    getBinPath,
    spawnShell,
    mirror,
}
