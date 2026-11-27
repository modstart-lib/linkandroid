import {t} from '../../config/lang'
import type {DeviceBridge} from './bridge'

export type AgentDeviceInfo = {
    id: string
    name?: string
    model?: string
    status?: string
}

const pyStr = (value: string) => JSON.stringify(String(value))
const pyBool = (value: boolean) => (value ? 'True' : 'False')

/** Tools shared with the task AI; `device_list` is AI-chat only. */
export const DEVICE_TOOL_NAMES = [
    'device_observe',
    'device_tap',
    'device_input',
    'device_key',
    'device_swipe',
    'device_open_app',
    'device_app_list',
    'device_sleep',
    'device_reconnect',
]

export const AI_DEVICE_TOOL_NAMES = [...DEVICE_TOOL_NAMES, 'device_list']

const MAX_DEVICE_TOOL_CALLS = 80
const MAX_BATCH_DEVICES = 5

type DeviceTarget = {id: string; label: string}

const labelOf = (device: AgentDeviceInfo) => device.name || device.model || device.id

const statusText = (status?: string) =>
    String(status || '').toLowerCase() === 'offline' ? t('deviceTool.offline') : t('deviceTool.online')

const describeDevices = (devices: AgentDeviceInfo[], defaultId: string) => {
    if (devices.length === 0) return t('deviceTool.noDevices')
    const lines = devices.map((device, index) => {
        const parts = [labelOf(device), `（${device.id}）`]
        if (device.model && device.model !== labelOf(device)) parts.push(`· ${device.model}`)
        parts.push(`· ${statusText(device.status)}`)
        if (device.id === defaultId) parts.push(t('deviceTool.defaultMark'))
        return `${index + 1}. ${parts.join(' ')}`
    })
    return [t('deviceTool.listTitle', {count: devices.length}), ...lines].join('\n')
}

/** Resolve model-supplied names/serials to real device ids (whitelist). */
const resolveTargets = (input: any, devices: AgentDeviceInfo[]): DeviceTarget[] => {
    const rawValues: string[] =
        Array.isArray(input?.devices) && input.devices.length
            ? input.devices.map((item: any) => String(item || '').trim())
            : [String(input?.device || '').trim()]
    const values = rawValues.filter(Boolean)
    if (values.length === 0) return [{id: '', label: ''}]
    const found = values.map((value) => {
        const device =
            devices.find((item) => item.id === value) ||
            devices.find((item) => (item.name || '') === value) ||
            devices.find((item) => (item.model || '') === value) ||
            devices.find((item) => (item.name || '').includes(value) && value.length > 1) ||
            devices.find((item) => value.length > 3 && item.id.includes(value))
        if (!device) {
            const list = devices.map((item) => `${labelOf(item)}（${item.id}）`).join(t('common.listSeparator'))
            throw new Error(t('deviceTool.unknownDevice', {name: value, list: list || t('deviceTool.noneList')}))
        }
        return {id: device.id, label: labelOf(device)}
    })
    const unique = found.filter((item, index) => found.findIndex((other) => other.id === item.id) === index)
    if (unique.length > MAX_BATCH_DEVICES) {
        throw new Error(t('deviceTool.batchTooMany', {max: MAX_BATCH_DEVICES, count: unique.length}))
    }
    return unique
}

const indent = (lines: string[]) => lines.map((line) => (line ? `    ${line}` : ''))

/**
 * Build one snippet that runs on every target. A single target keeps the old
 * output shape; a batch wraps each phone in try/except so one failure does not
 * stop the others.
 */
const runOnTargets = (targets: DeviceTarget[], action: (deviceExpr: string, batch: boolean) => string[]) => {
    const single = targets.length === 1 && !targets[0].id
    if (single) {
        return [`device = target()`, `_p = ''`, ...action('target()', false)].join('\n')
    }
    if (targets.length === 1) {
        const target = targets[0]
        const expr = `target(${pyStr(target.id)})`
        return [`device = ${expr}`, `_p = ${pyStr(`${target.label}｜`)}`, ...action(expr, false)].join('\n')
    }
    return targets
        .map((target) => {
            const expr = `target(${pyStr(target.id)})`
            return [
                'try:',
                `    device = ${expr}`,
                `    _p = ${pyStr(`${target.label}｜`)}`,
                ...indent(action(expr, true)),
                'except Exception as error:',
                `    print(${pyStr(t('deviceTool.perDeviceFailed', {label: target.label}))} + str(error)[:200])`,
            ].join('\n')
        })
        .join('\n')
}

/** Register the real-device control tools on an OpenCode tool editor. */
export const registerDeviceTools = (
    editor: any,
    bridge: DeviceBridge,
    devices: AgentDeviceInfo[] = [],
    defaultId = '',
) => {
    const resolvedDefaultId = defaultId || devices[0]?.id || ''
    let calls = 0
    const run = async (code: string, timeoutMs = 25000) => {
        calls++
        if (calls > MAX_DEVICE_TOOL_CALLS) {
            return {
                content: t('deviceTool.callLimit', {max: MAX_DEVICE_TOOL_CALLS}),
            }
        }
        try {
            const text = await bridge.call(code, timeoutMs)
            return {content: (text || 'ok').slice(0, 18000)}
        } catch (error: any) {
            return {content: t('deviceTool.executionFailed', {error: error?.message || error})}
        }
    }
    const define = (tool: any) => editor.add({options: {codemode: false}, ...tool})
    const execute = async (
        input: any,
        action: (deviceExpr: string, batch: boolean) => string[],
        baseTimeout = 25000,
    ) => {
        let targets: DeviceTarget[]
        try {
            targets = resolveTargets(input, devices)
        } catch (error: any) {
            return {content: t('deviceTool.invalidParams', {error: error?.message || error})}
        }
        const timeout = targets.length > 1 ? Math.min(baseTimeout * targets.length, 180000) : baseTimeout
        return run(runOnTargets(targets, action), timeout)
    }
    const deviceProps = {
        device: {
            type: 'string',
            description: '目标手机：名称或序列号。不传则用默认手机；传入后可操作指定那一台。',
        },
        devices: {
            type: 'array',
            items: {type: 'string'},
            description: `多台手机：一次在每一台上执行同一动作（最多 ${MAX_BATCH_DEVICES} 台），逐台返回结果。`,
        },
    }

    define({
        name: 'device_list',
        description:
            '列出本轮可操作的手机：名称、型号、序列号、在线状态和默认手机。用户提到多台手机或不确定控制哪台时先调用它。',
        input: {type: 'object', properties: {}},
        execute: async () => ({content: describeDevices(devices, resolvedDefaultId)}),
    })

    define({
        name: 'device_observe',
        description:
            '读取手机界面：包名、Activity、屏幕尺寸和可操作元素列表（文字/描述/id/坐标）。需要完整 XML 时传 full=true。操作后都应调用确认结果。传 device 看指定手机；传 devices 一次看多台（只返回每台摘要）。',
        input: {
            type: 'object',
            properties: {full: {type: 'boolean'}, ...deviceProps},
            required: [],
        },
        execute: async (toolInput: any) =>
            execute(
                toolInput,
                (deviceExpr, batch) => {
                    const detail = batch
                        ? [`print(_p + ${pyStr(`hint=${t('deviceTool.batchObserveHint')}`)})`]
                        : [
                              `if ${toolInput?.full ? 'True' : 'False'}:`,
                              '    print(xml[:6000])',
                              'else:',
                              '    def _attr(tag, name):',
                              '        found = _re.search(name + \'="([^"]*)"\', tag)',
                              "        return found.group(1) if found else ''",
                              '    seen = set()',
                              "    print(_p + '--- visible elements ---')",
                              "    for tag in _re.findall(r'<node[^>]*>', xml):",
                              "        text = _attr(tag, 'text')",
                              "        desc = _attr(tag, 'content-desc')",
                              "        rid = _attr(tag, 'resource-id')",
                              "        bounds = _attr(tag, 'bounds')",
                              '        if not (text or desc or rid):',
                              '            continue',
                              "        if bounds == '[0,0][0,0]':",
                              '            continue',
                              '        key = (text, desc, rid, bounds)',
                              '        if key in seen:',
                              '            continue',
                              '        seen.add(key)',
                              "        print(_p + 'text=%s | desc=%s | id=%s | bounds=%s | clickable=%s' % (text, desc, rid, bounds, _attr(tag, 'clickable')))",
                              '        if len(seen) >= 60:',
                              '            break',
                          ]
                    return [
                        'import re as _re',
                        'try:',
                        "    xml = retry(lambda: device.dumpHierarchy()) or ''",
                        'except Exception as error:',
                        "    xml = ''",
                        "    print(_p + 'xml_error=' + str(error)[:300])",
                        "pkg = str(device.currentPackage() or '')",
                        'if len(xml) < 800 or (pkg and (\'package="%s"\' % pkg) not in xml):',
                        "    print(_p + 'stale_hierarchy=true, reconnecting...')",
                        `    device = reset(${deviceExpr})`,
                        "    pkg = str(device.currentPackage() or '')",
                        '    try:',
                        "        xml = retry(lambda: device.dumpHierarchy()) or ''",
                        '    except Exception as error:',
                        "        xml = ''",
                        "        print(_p + 'xml_error_after_reset=' + str(error)[:300])",
                        "print(_p + 'package=' + pkg)",
                        'try:',
                        "    print(_p + 'activity=' + str(device.currentActivity()))",
                        'except Exception as error:',
                        "    print(_p + 'activity_error=' + str(error)[:200])",
                        'try:',
                        "    print(_p + 'screen=' + str(device.width()) + 'x' + str(device.height()))",
                        'except Exception as error:',
                        "    print(_p + 'screen_error=' + str(error)[:200])",
                        "print(_p + 'xml_length=' + str(len(xml)))",
                        ...detail,
                    ]
                },
                45000,
            ),
    })

    define({
        name: 'device_tap',
        description:
            '点击手机界面元素：可传 text / desc（content-desc）/ id（resource-id），或传坐标 x、y。传 device 操作指定手机；传 devices 在多台上执行同一点击。',
        input: {
            type: 'object',
            properties: {
                text: {type: 'string'},
                desc: {type: 'string'},
                id: {type: 'string'},
                x: {type: 'number'},
                y: {type: 'number'},
                ...deviceProps,
            },
            required: [],
        },
        execute: async (toolInput: any) => {
            if (
                !(typeof toolInput?.x === 'number' && typeof toolInput?.y === 'number') &&
                !toolInput?.text &&
                !toolInput?.desc &&
                !toolInput?.id
            ) {
                return {content: t('deviceTool.tapNoTarget')}
            }
            return execute(toolInput, () => {
                const lines: string[] = []
                if (typeof toolInput?.x === 'number' && typeof toolInput?.y === 'number') {
                    lines.push(`ok = device.click(${Math.round(toolInput.x)}, ${Math.round(toolInput.y)})`)
                } else if (toolInput?.text) {
                    lines.push(`ok = device.tapText(${pyStr(toolInput.text)}, timeout=5)`)
                } else if (toolInput?.desc) {
                    lines.push(`ok = device.tapDesc(${pyStr(toolInput.desc)}, timeout=5)`)
                } else {
                    lines.push(`ok = device.tapId(${pyStr(toolInput.id)}, timeout=5)`)
                }
                lines.push("print(_p + 'tap_ok=' + str(ok))", "print(_p + 'package=' + str(device.currentPackage()))")
                return lines
            })
        },
    })

    define({
        name: 'device_input',
        description:
            '向当前聚焦的输入框输入文字，可先 clear 清空。输入前先用 device_tap 点中输入框。传 device 操作指定手机；传 devices 在多台上输入同一段文字。',
        input: {
            type: 'object',
            properties: {text: {type: 'string'}, clear: {type: 'boolean'}, ...deviceProps},
            required: ['text'],
        },
        execute: async (toolInput: any) => {
            if (!toolInput?.text) return {content: t('deviceTool.missingText')}
            return execute(toolInput, () => [
                `ok = device.inputText(${pyStr(toolInput.text)}, clear=${pyBool(Boolean(toolInput.clear))})`,
                "print(_p + 'input_ok=' + str(ok))",
            ])
        },
    })

    define({
        name: 'device_key',
        description:
            '按系统按键：home、back、recent（最近任务）、enter（回车）。传 device 操作指定手机；传 devices 在多台上执行同一按键。',
        input: {
            type: 'object',
            properties: {key: {type: 'string', enum: ['home', 'back', 'recent', 'enter']}, ...deviceProps},
            required: ['key'],
        },
        execute: async (toolInput: any) => {
            const key = String(toolInput?.key || '')
            const code: Record<string, string> = {
                home: 'ok = device.home()',
                back: 'ok = device.back()',
                recent: 'ok = device.recent()',
                enter: "ok = device.press('enter')",
            }
            if (!code[key]) return {content: t('deviceTool.invalidKey')}
            return execute(toolInput, () => [
                code[key],
                "print(_p + 'key_ok=' + str(ok))",
                "print(_p + 'package=' + str(device.currentPackage()))",
            ])
        },
    })

    define({
        name: 'device_swipe',
        description: '按方向滑动当前界面：up / down / left / right。传 device 操作指定手机；传 devices 在多台上滑动。',
        input: {
            type: 'object',
            properties: {
                direction: {type: 'string', enum: ['up', 'down', 'left', 'right']},
                ...deviceProps,
            },
            required: ['direction'],
        },
        execute: async (toolInput: any) => {
            const direction = String(toolInput?.direction || '')
            if (!['up', 'down', 'left', 'right'].includes(direction)) {
                return {content: t('deviceTool.invalidDirection')}
            }
            return execute(toolInput, () => [
                `device.swipeExt(${pyStr(direction)})`,
                'la.sleep(0.8)',
                "print(_p + 'swipe_ok=true')",
            ])
        },
    })

    define({
        name: 'device_open_app',
        description:
            '按包名启动应用，例如 com.xingin.xhs。启动后会等待 2 秒。传 device 操作指定手机；传 devices 在多台上打开同一应用。',
        input: {
            type: 'object',
            properties: {package: {type: 'string'}, ...deviceProps},
            required: ['package'],
        },
        execute: async (toolInput: any) => {
            const pkg = String(toolInput?.package || '').trim()
            if (!pkg) return {content: t('deviceTool.missingPackage')}
            return execute(toolInput, () => [
                `ok = device.appStart(${pyStr(pkg)})`,
                'la.sleep(2)',
                "print(_p + 'open_ok=' + str(ok))",
                "print(_p + 'package=' + str(device.currentPackage()))",
            ])
        },
    })

    define({
        name: 'device_app_list',
        description: '列出手机已安装应用的包名，用于确认目标应用的包名。传 device 查看指定手机；传 devices 查看多台。',
        input: {
            type: 'object',
            properties: {...deviceProps},
        },
        execute: async (toolInput: any) =>
            execute(toolInput, () => [
                'try:',
                '    apps = retry(lambda: device.appList()) or []',
                'except Exception as error:',
                '    apps = []',
                "    print(_p + 'app_list_error=' + str(error)[:300])",
                "print(_p + 'app_count=' + str(len(apps)))",
                "print(_p + '\\n'.join([str(a) for a in apps[:200]]))",
            ]),
    })

    define({
        name: 'device_reconnect',
        description:
            '重置与手机的自动化连接。界面读取结果明显不对（例如一直在桌面）或点击无效时调用。传 device 重建指定手机；传 devices 重建多台。',
        input: {
            type: 'object',
            properties: {...deviceProps},
        },
        execute: async (toolInput: any) =>
            execute(
                toolInput,
                (deviceExpr) => [
                    `device = reset(${deviceExpr})`,
                    "print(_p + 'reconnect_ok=true')",
                    "print(_p + 'package=' + str(device.currentPackage()))",
                ],
                60000,
            ),
    })

    define({
        name: 'device_sleep',
        description: '等待指定的秒数（最多 10 秒），用于等待页面加载。',
        input: {
            type: 'object',
            properties: {seconds: {type: 'number'}},
            required: ['seconds'],
        },
        execute: async (toolInput: any) => {
            const seconds = Math.min(Math.max(Number(toolInput?.seconds) || 1, 0.2), 10)
            return run([`la.sleep(${seconds})`, "print('sleep_done=true')"].join('\n'))
        },
    })
}
