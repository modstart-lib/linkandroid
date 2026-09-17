import {devProResolve, extraResolveBin, extraResolveWithPlatform, isDev, isWin, resolveAdbBin} from '../../lib/env'
import adb from '../adb/render'
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
    // 兼容 adb / 终端可能带回车（\r\n）的输出
    const lines = output.split(/\r?\n/)
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

// scrcpy 通过服务端 PackageManager 枚举「可启动应用」，部分 ROM（如澎湃 3.0 / Android 16）
// 会限制应用列表权限导致枚举为空，此时退回 adb 通道获取带桌面的应用
const listAppsByAdb = async (serial: string): Promise<ScrcpyApp[]> => {
    const output = await adb.shell(
        serial,
        'cmd package query-activities --brief -a android.intent.action.MAIN -c android.intent.category.LAUNCHER',
    )
    const ids: string[] = []
    for (const line of output.split(/\r?\n/)) {
        const matched = line.trim().match(/^([A-Za-z0-9_.]+)\/[^\s]*$/)
        if (matched && !ids.includes(matched[1])) {
            ids.push(matched[1])
        }
    }
    if (!ids.length) return []
    const systemOutput = await adb.shell(serial, 'pm list packages -s')
    const systemPackages = systemOutput
        .split(/\r?\n/)
        .map((line) => line.trim().replace(/^package:/, ''))
        .filter(Boolean)
    // adb 通道拿不到应用名称，使用包名兜底（图标仍按包名自动获取）
    return ids.sort().map((id) => ({id, name: id, system: systemPackages.includes(id)}))
}

const listApps = async (serial: string): Promise<ScrcpyApp[]> => {
    let output = ''
    let scrcpyError: unknown = null
    try {
        const controller = await spawnShell(['--serial', serial, '--list-apps'])
        output = await controller.result()
        const apps = parseAppList(output)
        if (apps.length) return apps
    } catch (error) {
        scrcpyError = error
        output = String(error)
    }
    try {
        const fallback = await listAppsByAdb(serial)
        if (fallback.length) return fallback
    } catch (error) {
        Log.info('Scrcpy.listApps.fallback.error', error)
    }
    if (scrcpyError) throw scrcpyError
    // 两条通道都拿不到应用时抛出原始信息，界面上展示出来便于定位原因
    const tail = output
        .split(/\r?\n/)
        .filter((line) => line.trim())
        .slice(-12)
        .join('\n')
    throw new Error(`MirrorAppListEmpty\n${tail}`)
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
