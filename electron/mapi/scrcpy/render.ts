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
        maxLogLines?: number
    } | null = null,
) => {
    option = Object.assign(
        {
            env: {},
            args: [],
            maxLogLines: 0,
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

export type ScrcpyApp = {
    id: string
    name: string
    system: boolean
}

// Parse `scrcpy --list-apps` output, whose lines look like:
//   ` * Google Play 商店          com.android.vending`  (* = system app)
//   ` - 微信                      com.tencent.mm`
// App names longer than the 30-chars column wrap, and the package name is
// printed alone on the following line.
const parseAppList = (output: string): ScrcpyApp[] => {
    const apps: ScrcpyApp[] = []
    const lines = output.split('\n')
    for (let i = 0; i < lines.length; i++) {
        const matched = lines[i].match(/^ ([*-]) (.+)$/)
        if (!matched) continue
        const system = '*' === matched[1]
        const content = matched[2]
        const tail = content.match(/^(.*)\s+(\S+)$/)
        let name = content
        let id = ''
        if (tail) {
            name = tail[1].trim()
            id = tail[2]
        } else {
            const wrapped = (lines[i + 1] || '').match(/^\s+(\S+)$/)
            if (!wrapped) continue
            name = content.trim()
            id = wrapped[1]
        }
        if (!id) continue
        apps.push({id, name, system})
    }
    return apps
}

const listApps = async (serial: string): Promise<ScrcpyApp[]> => {
    const controller = await spawnShell(['--serial', serial, '--list-apps'])
    return parseAppList(await controller.result())
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
        maxLogLines?: number
    },
) => {
    option = Object.assign(
        {
            env: {},
            args: [],
            maxLogLines: 0,
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
        maxLogLines: option.maxLogLines,
    })
}

export default {
    getBinPath,
    spawnShell,
    listApps,
    mirror,
}
