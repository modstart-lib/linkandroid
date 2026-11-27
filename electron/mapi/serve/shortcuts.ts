import {randomBytes} from 'node:crypto'
import {resolveAdbBin} from '../../lib/env'
import {isValidKeys, SHORTCUT_CONFIG_KEY} from '../../lib/shortcutKeys'
import {Apps} from '../app'
import {ConfigMain} from '../config/main'
import {Log} from '../log/main'

export type ShortcutActionType = 'tap' | 'longPress' | 'multiTap' | 'swipe' | 'panel' | 'text' | 'app'

export type ShortcutAction = {
    type: ShortcutActionType
    x?: number // 0~1，相对屏幕宽度的比例
    y?: number // 0~1，相对屏幕高度的比例
    x2?: number // 滑动终点
    y2?: number
    duration?: number // 长按 / 滑动时长（毫秒）
    times?: number // 连点次数
    interval?: number // 连点间隔（毫秒）
    buttonId?: string // 面板按钮 id
    text?: string
    package?: string
}

export type ShortcutItem = {
    id: string
    keys: string
    action: ShortcutAction
    enabled?: boolean
    deviceId?: string // 空 = 对所有设备生效
}

export type ShortcutRunner = {
    send: (deviceId: string, message: object) => void
    panel: (deviceId: string, buttonId: string) => void
}

export {SHORTCUT_CONFIG_KEY}

const genId = () => randomBytes(4).toString('hex')

export const loadItems = async (): Promise<ShortcutItem[]> => {
    const items = await ConfigMain.get(SHORTCUT_CONFIG_KEY, [])
    if (!Array.isArray(items)) {
        return []
    }
    return items
}

// 单机配置优先于全局配置：同一个组合键被设备单独覆盖时，只下发设备自己的那条
const pickForDevice = (items: ShortcutItem[], deviceId: string): ShortcutItem[] => {
    const usable = items.filter((item) => {
        return item.enabled !== false && isValidKeys(item.keys) && (!item.deviceId || item.deviceId === deviceId)
    })
    usable.sort((a, b) => {
        return (a.deviceId ? 0 : 1) - (b.deviceId ? 0 : 1)
    })
    const picked = new Map<string, ShortcutItem>()
    for (const item of usable) {
        if (!picked.has(item.keys)) {
            picked.set(item.keys, item)
        }
    }
    return [...picked.values()]
}

export const buildMessage = (items: ShortcutItem[], deviceId: string) => {
    return {
        type: 'shortcuts',
        data: {
            items: pickForDevice(items, deviceId).map((item) => ({id: item.id, keys: item.keys})),
        },
    }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const sendTouch = (
    runner: ShortcutRunner,
    deviceId: string,
    action: 'down' | 'up' | 'move',
    x: number,
    y: number,
    width: number,
    height: number,
) => {
    const type = action === 'down' ? 'touch_down' : action === 'up' ? 'touch_up' : 'touch_move'
    runner.send(deviceId, {
        type,
        id: genId(),
        data: {
            pointer_id: '0',
            x: Math.max(0, Math.min(width - 1, Math.round(x * width))),
            y: Math.max(0, Math.min(height - 1, Math.round(y * height))),
            pressure: 1,
            width,
            height,
        },
    })
}

const launchApp = async (deviceId: string, pkg: string) => {
    if (!pkg) {
        return
    }
    const bin = resolveAdbBin()
    const controller = await Apps.spawnShell(
        [bin, '-s', deviceId, 'shell', 'monkey', '-p', pkg, '-c', 'android.intent.category.LAUNCHER', '1'],
        {shell: false},
    )
    await controller.result()
}

export const handleShortcut = async (
    deviceId: string,
    shortcutId: string,
    size: {width: number; height: number},
    runner: ShortcutRunner,
) => {
    const items = await loadItems()
    const item = items.find((one) => {
        return one.id === shortcutId && (!one.deviceId || one.deviceId === deviceId)
    })
    if (!item || item.enabled === false) {
        Log.info(`Shortcut ${shortcutId} not found or disabled`)
        return
    }

    const action = item.action
    const width = size.width || 0
    const height = size.height || 0
    Log.info(`Shortcut triggered: ${shortcutId} (${item.keys}) type=${action.type}`)

    if (action.type === 'panel') {
        if (action.buttonId) {
            runner.panel(deviceId, action.buttonId)
        }
        return
    }

    if (action.type === 'text') {
        if (action.text) {
            runner.send(deviceId, {
                type: 'text',
                id: genId(),
                data: {text: action.text},
            })
        }
        return
    }

    if (action.type === 'app') {
        if (action.package) {
            await launchApp(deviceId, action.package)
        }
        return
    }

    if (width <= 0 || height <= 0) {
        Log.info(`Shortcut ${shortcutId} skipped: unknown device size`)
        return
    }

    const x = action.x ?? 0.5
    const y = action.y ?? 0.5

    if (action.type === 'tap') {
        sendTouch(runner, deviceId, 'down', x, y, width, height)
        await sleep(60)
        sendTouch(runner, deviceId, 'up', x, y, width, height)
        return
    }

    if (action.type === 'longPress') {
        const duration = Math.max(200, action.duration || 800)
        sendTouch(runner, deviceId, 'down', x, y, width, height)
        await sleep(duration)
        sendTouch(runner, deviceId, 'up', x, y, width, height)
        return
    }

    if (action.type === 'multiTap') {
        const times = Math.max(1, Math.min(20, action.times || 2))
        const interval = Math.max(40, action.interval || 120)
        for (let i = 0; i < times; i++) {
            sendTouch(runner, deviceId, 'down', x, y, width, height)
            await sleep(50)
            sendTouch(runner, deviceId, 'up', x, y, width, height)
            if (i < times - 1) {
                await sleep(interval)
            }
        }
        return
    }

    if (action.type === 'swipe') {
        const x2 = action.x2 ?? 0.5
        const y2 = action.y2 ?? 0.2
        const duration = Math.max(80, Math.min(5000, action.duration || 300))
        const steps = 12
        sendTouch(runner, deviceId, 'down', x, y, width, height)
        for (let i = 1; i <= steps; i++) {
            const ratio = i / steps
            await sleep(duration / steps)
            sendTouch(runner, deviceId, 'move', x + (x2 - x) * ratio, y + (y2 - y) * ratio, width, height)
        }
        sendTouch(runner, deviceId, 'up', x2, y2, width, height)
    }
}

export default {
    loadItems,
    buildMessage,
    handleShortcut,
    SHORTCUT_CONFIG_KEY,
}
