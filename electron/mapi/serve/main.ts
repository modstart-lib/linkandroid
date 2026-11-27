import {randomBytes} from 'node:crypto'
import {ipcMain} from 'electron'
import {WebSocket, WebSocketServer} from 'ws'
import {t} from '../../config/lang'
import {Apps} from '../app'
import {Log} from '../log/main'
import shortcuts from './shortcuts'
import type {ShortcutRunner} from './shortcuts'

// 生成 8 位十六进制随机 id（协议要求）
const genId = () => randomBytes(4).toString('hex')

let wss: WebSocketServer | null = null
let wsPort: number = 10667
const clients: Map<string, Set<WebSocket>> = new Map()
const deviceStates: Map<string, any> = new Map()
// 每个设备的随动状态
const deviceFollowMode: Map<string, boolean> = new Map()
// 每个设备的置顶状态
const deviceTopMode: Map<string, boolean> = new Map()
// 每个设备的屏幕开关状态（true=亮屏，false=息屏）
const deviceScreenOn: Map<string, boolean> = new Map()

// 生成面板配置（根据设备随动状态和置顶状态动态生成）
const getPanelConfig = (deviceId: string) => {
    const isFollowMode = deviceFollowMode.get(deviceId) || false
    const isTopMode = deviceTopMode.get(deviceId) || false
    const isScreenOn = deviceScreenOn.get(deviceId)
    // 默认 true（亮屏），除非显式设为 false
    const screenState = isScreenOn !== undefined ? isScreenOn : true
    return {
        type: 'panel',
        data: {
            buttons: [
                {id: 'home', icon: 'home', title: t('panel.home')},
                {id: 'back', icon: 'back', title: t('panel.back')},
                {id: 'recent', icon: 'task', title: t('panel.recent')},
                {id: 'volume_up', icon: 'v-plus', title: t('panel.volumeUp')},
                {id: 'volume_down', icon: 'v-minus', title: t('panel.volumeDown')},
                {id: 'screenshot', icon: 'screenshot', title: t('panel.screenshot')},
                {id: 'rotate', icon: 'rotate', title: t('panel.rotate')},
                {
                    id: 'screen_power',
                    icon: screenState ? 'screen-on' : 'screen-off',
                    title: t('panel.screenPower'),
                },
                {id: 'follow', icon: isFollowMode ? 'follow_active' : 'follow', title: t('panel.follow')},
                {id: 'toggle_top', icon: isTopMode ? 'top_active' : 'top', title: t('panel.toggleTop')},
                {id: 'close', icon: 'quit', title: t('panel.close')},
            ],
        },
    }
}

const start = async (): Promise<number> => {
    if (wss) {
        Log.info('WebSocket server already running on port ' + wsPort)
        return wsPort
    }

    try {
        wsPort = await Apps.availablePort(10667, 'websocket-server', 60)
        wss = new WebSocketServer({port: wsPort})

        wss.on('connection', (ws: WebSocket, req) => {
            const url = new URL(req.url || '', `ws://localhost:${wsPort}`)
            const clientType = url.searchParams.get('type') || 'Unknown'
            const deviceId = url.searchParams.get('deviceId') || ''

            // 存储客户端信息到ws对象上，用于随动功能
            ;(ws as any)._clientType = clientType
            ;(ws as any)._deviceId = deviceId

            Log.info(`WebSocket client connected: type=${clientType}, deviceId=${deviceId}`)

            if (!clients.has(clientType)) {
                clients.set(clientType, new Set())
            }
            clients.get(clientType)!.add(ws)

            if (clientType === 'DeviceMirror') {
            }

            if (clientType === 'Render') {
                deviceStates.forEach((state, deviceId) => {
                    ws.send(
                        JSON.stringify({
                            type: 'DeviceStatus',
                            id: deviceId,
                            status: state.connected ? 'connected' : 'disconnected',
                        }),
                    )
                })
                Log.info(`Sent all device states to Render client`)
            }

            if (clientType === 'DeviceManage' && deviceId) {
                deviceStates.set(deviceId, {connected: true})
                broadcast('Render', {
                    type: 'DeviceConnect',
                    id: deviceId,
                })
                Log.info(`Device connected: ${deviceId}`)
            }

            ws.on('message', (message: Buffer) => {
                // Log.info(`Received message from ${clientType} (${deviceId}): ` + message.toString());
                try {
                    const data = JSON.parse(message.toString())
                    if (clientType === 'DeviceManage') {
                        if (data.type === 'preview') {
                            broadcast('Render', {
                                type: 'DevicePreview',
                                deviceId,
                                data: data.data,
                            })
                        } else {
                            Log.info(`${clientType}.msg.${deviceId}`, data)
                        }
                    } else if (clientType === 'DeviceMirror') {
                        if (data.type === 'preview') {
                            // 投屏进程也负责发送设备卡片预览图（投屏期间不再单独启动预览进程）
                            broadcast('Render', {
                                type: 'DevicePreview',
                                deviceId,
                                data: data.data,
                            })
                        } else if (data.type === 'ready') {
                            ws.send(JSON.stringify(getPanelConfig(deviceId)))
                            Log.info(`Sent panel config to DeviceMirror: deviceId=${deviceId}`)
                            // 投屏窗口就绪后下发当前设备的自定义快捷键
                            shortcuts
                                .loadItems()
                                .then((items) => {
                                    if (ws.readyState === WebSocket.OPEN) {
                                        ws.send(JSON.stringify(shortcuts.buildMessage(items, deviceId)))
                                        Log.info(`Sent shortcuts to DeviceMirror: deviceId=${deviceId}`)
                                    }
                                })
                                .catch((error) => {
                                    Log.error(`Failed to send shortcuts: ${error.message}`)
                                })
                            // 查询设备实际屏幕状态，确保图标与真实状态一致
                            ws.send(
                                JSON.stringify({
                                    type: 'screen_power',
                                    id: genId(),
                                    data: {action: 'query'},
                                }),
                            )
                        } else if (data.type === 'screen_power' && data.data?.action === 'query') {
                            // screen_power query 回复，更新屏幕状态
                            const isOn = data.data?.state?.on
                            if (isOn !== undefined) {
                                deviceScreenOn.set(deviceId, isOn)
                                Log.info(`Screen state updated for ${deviceId}: ${isOn ? 'on' : 'off'}`)
                                ws.send(JSON.stringify(getPanelConfig(deviceId)))
                            }
                        } else if (data.type === 'panel_button_click') {
                            const buttonId = data.data?.id
                            if (buttonId) {
                                handlePanelButton(deviceId, buttonId, ws)
                            }
                        } else if (data.type === 'shortcut') {
                            // 投屏窗口内命中用户配置的快捷键
                            const shortcutId = data.data?.id
                            if (shortcutId) {
                                shortcuts
                                    .handleShortcut(
                                        deviceId,
                                        shortcutId,
                                        {
                                            width: Number(data.data?.width) || 0,
                                            height: Number(data.data?.height) || 0,
                                        },
                                        shortcutRunner,
                                    )
                                    .catch((error) => {
                                        Log.error(`Shortcut ${shortcutId} failed: ${error.message}`)
                                    })
                            }
                        } else if (isDeviceEvent(data.type)) {
                            const isFollowMode = deviceFollowMode.get(deviceId) || false
                            if (isFollowMode) {
                                handleFollowMode(deviceId, data)
                            }
                        } else {
                            Log.info(`${clientType}.msg.${deviceId}`, data)
                        }
                    }
                } catch (error) {
                    Log.error(`Failed to process message from ${clientType} (${deviceId}): ` + error.message)
                }
            })

            ws.on('close', () => {
                clients.get(clientType)?.delete(ws)
                Log.info(`WebSocket client disconnected: type=${clientType}, id=${deviceId}`)
                if (clientType === 'DeviceManage') {
                    deviceStates.delete(deviceId)
                    broadcast('Render', {
                        type: 'DeviceDisconnect',
                        id: deviceId,
                    })
                }
                // 清理设备的随动状态、置顶状态和屏幕开关状态
                if (clientType === 'DeviceMirror' && deviceId) {
                    deviceFollowMode.delete(deviceId)
                    deviceTopMode.delete(deviceId)
                    deviceScreenOn.delete(deviceId)
                }
            })

            ws.on('error', (error) => {
                Log.error('WebSocket client error: ' + error.message)
            })
        })

        wss.on('error', (error) => {
            Log.error('WebSocket server error: ' + error.message)
        })

        Log.info(`WebSocket server started on port ${wsPort}`)
        return wsPort
    } catch (error) {
        Log.error('Failed to start WebSocket server: ' + error.message)
        throw error
    }
}

const broadcast = (clientType: string, message: object) => {
    const clientSet = clients.get(clientType)
    if (clientSet) {
        const messageStr = JSON.stringify(message)
        clientSet.forEach((ws) => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(messageStr)
            }
        })
    }
}

// 处理面板按钮动作：投屏窗口点击与快捷键触发共用同一套逻辑
const handlePanelButton = (deviceId: string, buttonId: string, ws: WebSocket) => {
    if (buttonId === 'follow') {
        const currentState = deviceFollowMode.get(deviceId) || false
        deviceFollowMode.set(deviceId, !currentState)
        Log.info(`FollowMode toggled for ${deviceId}: ${!currentState}`)
        ws.send(JSON.stringify(getPanelConfig(deviceId)))
    } else if (buttonId === 'toggle_top') {
        const currentState = deviceTopMode.get(deviceId) || false
        const newState = !currentState
        deviceTopMode.set(deviceId, newState)
        Log.info(`TopMode toggled for ${deviceId}: ${newState}`)
        ws.send(
            JSON.stringify({
                type: 'top',
                data: {
                    enable: newState,
                },
            }),
        )
        ws.send(JSON.stringify(getPanelConfig(deviceId)))
    } else if (buttonId === 'screen_power') {
        const currentState = deviceScreenOn.get(deviceId)
        const newState = currentState !== undefined ? !currentState : false
        deviceScreenOn.set(deviceId, newState)
        Log.info(`Screen power toggled for ${deviceId}: ${newState ? 'on' : 'off'}`)
        // 通过 scrcpy 控制协议设置屏幕电源（不触发锁屏）
        ws.send(
            JSON.stringify({
                type: 'screen_power',
                id: genId(),
                data: {action: newState ? 'on' : 'off'},
            }),
        )
        ws.send(JSON.stringify(getPanelConfig(deviceId)))
        const isFollowMode = deviceFollowMode.get(deviceId) || false
        if (isFollowMode) {
            handlePanelButtonFollowMode(deviceId, buttonId)
        }
    } else if (buttonId === 'rotate') {
        Log.info(`Rotate device requested for ${deviceId}`)
        // 旋转手机屏幕方向（scrcpy ROTATE_DEVICE 控制消息）
        ws.send(
            JSON.stringify({
                type: 'rotate',
                id: genId(),
            }),
        )
        const isFollowMode = deviceFollowMode.get(deviceId) || false
        if (isFollowMode) {
            broadcastRotateToOtherDevices(deviceId)
        }
    } else if (buttonId === 'close') {
        ws.send(
            JSON.stringify({
                type: 'quit',
            }),
        )
    } else {
        broadcast('Render', {
            type: 'DevicePanelButtonClick',
            deviceId,
            data: {id: buttonId},
        })
        const isFollowMode = deviceFollowMode.get(deviceId) || false
        if (isFollowMode && isPanelButtonFollowable(buttonId)) {
            handlePanelButtonFollowMode(deviceId, buttonId)
        }
    }
}

// 向指定设备的投屏连接发送消息
const sendToDeviceMirror = (deviceId: string, message: object) => {
    const clientSet = clients.get('DeviceMirror')
    if (!clientSet) {
        return
    }
    const messageStr = JSON.stringify(message)
    clientSet.forEach((client) => {
        if ((client as any)._deviceId === deviceId && client.readyState === WebSocket.OPEN) {
            client.send(messageStr)
        }
    })
}

const shortcutRunner: ShortcutRunner = {
    send: (deviceId, message) => sendToDeviceMirror(deviceId, message),
    panel: (deviceId, buttonId) => {
        clients.get('DeviceMirror')?.forEach((client) => {
            if ((client as any)._deviceId === deviceId && client.readyState === WebSocket.OPEN) {
                handlePanelButton(deviceId, buttonId, client)
            }
        })
    },
}

// 配置变化后把最新快捷键同步给已连接的投屏窗口（按设备分别下发全局 + 单机配置）
const sendShortcuts = async () => {
    const items = await shortcuts.loadItems()
    clients.get('DeviceMirror')?.forEach((client) => {
        if (client.readyState !== WebSocket.OPEN) {
            return
        }
        const deviceId = (client as any)._deviceId || ''
        client.send(JSON.stringify(shortcuts.buildMessage(items, deviceId)))
    })
}

// 向指定设备的 DeviceManage 客户端发送消息
const broadcastToDevice = (deviceId: string, message: object) => {
    const clientSet = clients.get('DeviceManage')
    if (clientSet) {
        const messageStr = JSON.stringify(message)
        clientSet.forEach((ws) => {
            const clientDeviceId = (ws as any)._deviceId
            if (clientDeviceId === deviceId && ws.readyState === WebSocket.OPEN) {
                ws.send(messageStr)
                Log.info(`Message sent to DeviceManage:${deviceId}`, message)
            }
        })
    }
}

// 判断是否为设备操作事件
const isDeviceEvent = (eventType: string): boolean => {
    const deviceEventTypes = [
        'key', // 按键事件
        'text', // 文本输入事件
        'touch_down', // 触摸按下
        'touch_move', // 触摸移动
        'touch_up', // 触摸抬起
        'scroll_h', // 水平滚动
        'scroll_v', // 垂直滚动
    ]
    return deviceEventTypes.includes(eventType)
}

// 判断面板按钮是否支持随动
const isPanelButtonFollowable = (buttonId: string): boolean => {
    const followableButtons = ['home', 'back', 'recent', 'volume_up', 'volume_down', 'screenshot', 'screen_power']
    return followableButtons.includes(buttonId)
}

// 将面板按钮ID转换为对应的Android按键码（数字）
const panelButtonToKeyCode = (buttonId: string): number | null => {
    const keyCodeMap: Record<string, number> = {
        home: 3, // KEYCODE_HOME
        back: 4, // KEYCODE_BACK
        recent: 187, // KEYCODE_APP_SWITCH
        volume_up: 24, // KEYCODE_VOLUME_UP
        volume_down: 25, // KEYCODE_VOLUME_DOWN
        screenshot: 120, // KEYCODE_SYSRQ
        screen_power: 26, // KEYCODE_POWER
    }
    return keyCodeMap[buttonId] || null
}

// 随动目标：其它设备的预览进程或投屏进程（投屏期间预览进程已停止）；
// 同一设备可能同时有主投屏与应用投屏多个连接，每台设备只下发一次，避免手机上执行两次
const followTargets = (sourceDeviceId: string): Array<{ws: WebSocket; deviceId: string; type: string}> => {
    const targets: Array<{ws: WebSocket; deviceId: string; type: string}> = []
    const seen = new Set<string>()
    wss?.clients.forEach((client) => {
        const ws = client as any
        const clientDeviceId = ws._deviceId
        const clientType = ws._clientType
        if (clientType !== 'DeviceManage' && clientType !== 'DeviceMirror') {
            return
        }
        if (!clientDeviceId || clientDeviceId === sourceDeviceId || seen.has(clientDeviceId)) {
            return
        }
        if (client.readyState !== WebSocket.OPEN) {
            return
        }
        seen.add(clientDeviceId)
        targets.push({ws: client, deviceId: clientDeviceId, type: clientType})
    })
    return targets
}

// 处理面板按钮的随动模式 - 将按钮操作转换为key事件并广播
const handlePanelButtonFollowMode = (sourceDeviceId: string, buttonId: string) => {
    const keyCode = panelButtonToKeyCode(buttonId)
    if (!keyCode) {
        Log.info(`FollowMode: Unknown button ${buttonId}, skip broadcasting`)
        return
    }

    // 构造按键按下事件
    const keyDownEvent = {
        type: 'key',
        data: {
            action: 'down',
            keycode: keyCode,
            repeat: 0,
            metastate: 0,
        },
    }

    // 构造按键抬起事件
    const keyUpEvent = {
        type: 'key',
        data: {
            action: 'up',
            keycode: keyCode,
            repeat: 0,
            metastate: 0,
        },
    }

    Log.info(`FollowMode: Broadcasting panel button from ${sourceDeviceId}`, buttonId)
    const targets = followTargets(sourceDeviceId)
    for (const target of targets) {
        try {
            // 发送按下和抬起两个事件
            target.ws.send(JSON.stringify(keyDownEvent))
            target.ws.send(JSON.stringify(keyUpEvent))
            Log.info(`FollowMode: Panel button sent to ${target.type}:${target.deviceId} ${buttonId}->${keyCode}`)
        } catch (error) {
            Log.error(`FollowMode: Failed to send panel button to ${target.deviceId}: ${error.message}`)
        }
    }
    const targetCount = targets.length

    if (targetCount === 0) {
        Log.info(`FollowMode: No target devices to forward panel button (source: ${sourceDeviceId})`)
    }
}

// 处理旋转按钮的随动模式 - 旋转无法用按键码表达，直接转发 rotate 控制消息
const broadcastRotateToOtherDevices = (sourceDeviceId: string) => {
    const rotateEvent = {
        type: 'rotate',
        id: genId(),
    }

    Log.info(`FollowMode: Broadcasting rotate from ${sourceDeviceId}`)
    const targets = followTargets(sourceDeviceId)
    for (const target of targets) {
        try {
            target.ws.send(JSON.stringify(rotateEvent))
            Log.info(`FollowMode: Rotate sent to ${target.type}:${target.deviceId}`)
        } catch (error) {
            Log.error(`FollowMode: Failed to send rotate to ${target.deviceId}: ${error.message}`)
        }
    }
    const targetCount = targets.length

    if (targetCount === 0) {
        Log.info(`FollowMode: No target devices to forward rotate (source: ${sourceDeviceId})`)
    }
}

// 处理随动模式 - 在main进程中直接转发事件给其他设备，不经过Render进程
const handleFollowMode = (sourceDeviceId: string, eventData: any) => {
    Log.info(`FollowMode: Broadcasting event from ${sourceDeviceId}`, eventData.type)
    const targets = followTargets(sourceDeviceId)
    for (const target of targets) {
        try {
            target.ws.send(JSON.stringify(eventData))
            Log.info(`FollowMode: Event sent to ${target.type}:${target.deviceId} ${JSON.stringify(eventData)}`)
        } catch (error) {
            Log.error(`FollowMode: Failed to send event to ${target.deviceId}: ${error.message}`)
        }
    }
    const targetCount = targets.length

    if (targetCount === 0) {
        Log.info(`FollowMode: No target devices to forward (source: ${sourceDeviceId})`)
    }
}

const stop = () => {
    if (wss) {
        // 先给所有DeviceManage和DeviceMirror发送quit命令
        const quitMessage = JSON.stringify({type: 'quit'})
        clients.forEach((clientSet, clientType) => {
            if (clientType === 'DeviceManage' || clientType === 'DeviceMirror') {
                clientSet.forEach((ws) => {
                    if (ws.readyState === WebSocket.OPEN) {
                        try {
                            ws.send(quitMessage)
                            Log.info(`Sent quit command to ${clientType}`)
                        } catch (error: any) {
                            Log.error(`Failed to send quit command to ${clientType}: ${error.message}`)
                        }
                    }
                })
            }
        })

        // 等待一小段时间确保消息发送完成
        const currentWss = wss
        setTimeout(() => {
            clients.forEach((clientSet) => {
                clientSet.forEach((ws) => {
                    ws.close()
                })
            })
            clients.clear()
            currentWss.close()
            wss = null
            Log.info('WebSocket server stopped')
        }, 100)
    }
}

const getPort = (): number => {
    return wsPort
}

const getAddress = (): string => {
    return `ws://localhost:${wsPort}`
}

ipcMain.handle('serve:start', async () => {
    return await start()
})

ipcMain.handle('serve:stop', async () => {
    return stop()
})

ipcMain.handle('serve:getPort', async () => {
    return getPort()
})

ipcMain.handle('serve:getAddress', async () => {
    return getAddress()
})

// 快捷键配置改动后，把最新配置推给已打开的投屏窗口
ipcMain.handle('serve:shortcutsSync', async () => {
    await sendShortcuts()
    return true
})

export default {
    start,
    stop,
    getPort,
    getAddress,
    broadcast,
}
