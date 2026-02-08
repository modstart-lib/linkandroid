import { ipcMain } from "electron";
import { WebSocket, WebSocketServer } from "ws";
import { t } from "../../config/lang";
import { Apps } from "../app";
import { Log } from "../log/main";

let wss: WebSocketServer | null = null;
let wsPort: number = 10667;
const clients: Map<string, Set<WebSocket>> = new Map();
const deviceStates: Map<string, any> = new Map();
// 每个设备的随动状态
const deviceFollowMode: Map<string, boolean> = new Map();
// 每个设备的置顶状态
const deviceTopMode: Map<string, boolean> = new Map();

const start = async (): Promise<number> => {
    if (wss) {
        Log.info("WebSocket server already running on port " + wsPort);
        return wsPort;
    }

    try {
        wsPort = await Apps.availablePort(10667, "websocket-server", 60);
        wss = new WebSocketServer({port: wsPort});

        wss.on("connection", (ws: WebSocket, req) => {

            const url = new URL(req.url || "", `ws://localhost:${wsPort}`);
            const clientType = url.searchParams.get("type") || "Unknown";
            const deviceId = url.searchParams.get("deviceId") || "";

            // 生成面板配置（根据设备随动状态和置顶状态动态生成）
            const getPanelConfig = (deviceId: string) => {
                const isFollowMode = deviceFollowMode.get(deviceId) || false;
                const isTopMode = deviceTopMode.get(deviceId) || false;
                return {
                    type: "panel",
                    data: {
                        buttons: [
                            {id: "home", icon:'home'},
                            {id: "back", icon:'back'},
                            {id: "recent", icon:'task'},
                            {id: "volume_up", icon:'v-plus'},
                            {id: "volume_down", icon:'v-minus'},
                            {id: "screenshot", icon:'screenshot'},
                            {id: "follow", icon: isFollowMode ? 'follow_active' : 'follow'},
                            {id: "toggle_top", icon: isTopMode ? 'top_active':'top'},
                            {id: "close", icon:'quit'},
                        ],
                    },
                };
            };

            // 存储客户端信息到ws对象上，用于随动功能
            (ws as any)._clientType = clientType;
            (ws as any)._deviceId = deviceId;

            Log.info(`WebSocket client connected: type=${clientType}, deviceId=${deviceId}`);

            if (!clients.has(clientType)) {
                clients.set(clientType, new Set());
            }
            clients.get(clientType)!.add(ws);

            if (clientType === "DeviceMirror") {

            }

            if (clientType === "Render") {
                deviceStates.forEach((state, deviceId) => {
                    ws.send(JSON.stringify({
                        type: "DeviceStatus",
                        id: deviceId,
                        status: state.connected ? "connected" : "disconnected",
                    }));
                });
                Log.info(`Sent all device states to Render client`);
            }

            if (clientType === "DeviceManage" && deviceId) {
                deviceStates.set(deviceId, {connected: true});
                broadcast("Render", {
                    type: "DeviceConnect",
                    id: deviceId,
                });
                Log.info(`Device connected: ${deviceId}`);
            }

            ws.on("message", (message: Buffer) => {
                // Log.info(`Received message from ${clientType} (${deviceId}): ` + message.toString());
                try {
                    const data = JSON.parse(message.toString());
                    if (clientType === "DeviceManage") {
                        if (data.type === "preview") {
                            broadcast("Render", {
                                type: "DevicePreview",
                                deviceId,
                                data: data.data,
                            });
                        } else {
                            Log.info(`${clientType}.msg.${deviceId}`, data);
                        }
                    } else if (clientType === "DeviceMirror") {
                        if (data.type === 'ready') {
                            ws.send(JSON.stringify(getPanelConfig(deviceId)));
                            Log.info(`Sent panel config to DeviceMirror: deviceId=${deviceId}`);
                        } else if (data.type === "panel_button_click") {
                            const buttonId = data.data?.id;
                            if (buttonId === "follow") {
                                const currentState = deviceFollowMode.get(deviceId) || false;
                                deviceFollowMode.set(deviceId, !currentState);
                                Log.info(`FollowMode toggled for ${deviceId}: ${!currentState}`);
                                ws.send(JSON.stringify(getPanelConfig(deviceId)));
                            } else if (buttonId === "toggle_top") {
                                const currentState = deviceTopMode.get(deviceId) || false;
                                const newState = !currentState;
                                deviceTopMode.set(deviceId, newState);
                                Log.info(`TopMode toggled for ${deviceId}: ${newState}`);
                                ws.send(JSON.stringify({
                                    type: "top",
                                    data: {
                                        enable: newState,
                                    },
                                }));
                                ws.send(JSON.stringify(getPanelConfig(deviceId)));
                            } else if (buttonId === "close") {
                                ws.send(JSON.stringify({
                                    type: "quit",
                                }));
                            } else {
                                data.deviceId = deviceId;
                                data.type = "DevicePanelButtonClick";
                                broadcast("Render", data);
                                const isFollowMode = deviceFollowMode.get(deviceId) || false;
                                if (isFollowMode && isPanelButtonFollowable(buttonId)) {
                                    handlePanelButtonFollowMode(deviceId, buttonId);
                                }
                            }
                        } else if (isDeviceEvent(data.type)) {
                            const isFollowMode = deviceFollowMode.get(deviceId) || false;
                            if (isFollowMode) {
                                handleFollowMode(deviceId, data);
                            }
                        } else {
                            Log.info(`${clientType}.msg.${deviceId}`, data);
                        }
                    }
                } catch (error) {
                    Log.error(`Failed to process message from ${clientType} (${deviceId}): ` + error.message);
                }
            });

            ws.on("close", () => {
                clients.get(clientType)?.delete(ws);
                Log.info(`WebSocket client disconnected: type=${clientType}, id=${deviceId}`);
                if (clientType === "DeviceManage") {
                    deviceStates.delete(deviceId);
                    broadcast("Render", {
                        type: "DeviceDisconnect",
                        id: deviceId,
                    });
                }
                // 清理设备的随动状态和置顶状态
                if (clientType === "DeviceMirror" && deviceId) {
                    deviceFollowMode.delete(deviceId);
                    deviceTopMode.delete(deviceId);
                }
            });

            ws.on("error", (error) => {
                Log.error("WebSocket client error: " + error.message);
            });
        });

        wss.on("error", (error) => {
            Log.error("WebSocket server error: " + error.message);
        });

        Log.info(`WebSocket server started on port ${wsPort}`);
        return wsPort;
    } catch (error) {
        Log.error("Failed to start WebSocket server: " + error.message);
        throw error;
    }
};

const broadcast = (clientType: string, message: object) => {
    const clientSet = clients.get(clientType);
    if (clientSet) {
        const messageStr = JSON.stringify(message);
        clientSet.forEach((ws) => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(messageStr);
            }
        });
    }
};

// 向指定设备的 DeviceManage 客户端发送消息
const broadcastToDevice = (deviceId: string, message: object) => {
    const clientSet = clients.get("DeviceManage");
    if (clientSet) {
        const messageStr = JSON.stringify(message);
        clientSet.forEach((ws) => {
            const clientDeviceId = (ws as any)._deviceId;
            if (clientDeviceId === deviceId && ws.readyState === WebSocket.OPEN) {
                ws.send(messageStr);
                Log.info(`Message sent to DeviceManage:${deviceId}`, message);
            }
        });
    }
};

// 判断是否为设备操作事件
const isDeviceEvent = (eventType: string): boolean => {
    const deviceEventTypes = [
        "key",          // 按键事件
        "text",         // 文本输入事件
        "touch_down",   // 触摸按下
        "touch_move",   // 触摸移动
        "touch_up",     // 触摸抬起
        "scroll_h",     // 水平滚动
        "scroll_v",     // 垂直滚动
    ];
    return deviceEventTypes.includes(eventType);
};

// 判断面板按钮是否支持随动
const isPanelButtonFollowable = (buttonId: string): boolean => {
    const followableButtons = [
        "home",
        "back",
        "recent",
        "volume_up",
        "volume_down",
        "screenshot",
    ];
    return followableButtons.includes(buttonId);
};

// 将面板按钮ID转换为对应的Android按键码（数字）
const panelButtonToKeyCode = (buttonId: string): number | null => {
    const keyCodeMap: Record<string, number> = {
        "home": 3,           // KEYCODE_HOME
        "back": 4,           // KEYCODE_BACK
        "recent": 187,       // KEYCODE_APP_SWITCH
        "volume_up": 24,     // KEYCODE_VOLUME_UP
        "volume_down": 25,   // KEYCODE_VOLUME_DOWN
        "screenshot": 120,   // KEYCODE_SYSRQ
    };
    return keyCodeMap[buttonId] || null;
};

// 处理面板按钮的随动模式 - 将按钮操作转换为key事件并广播
const handlePanelButtonFollowMode = (sourceDeviceId: string, buttonId: string) => {
    const keyCode = panelButtonToKeyCode(buttonId);
    if (!keyCode) {
        Log.info(`FollowMode: Unknown button ${buttonId}, skip broadcasting`);
        return;
    }

    // 构造按键按下事件
    const keyDownEvent = {
        type: "key",
        data: {
            action: "down",
            keycode: keyCode,
            repeat: 0,
            metastate: 0,
        },
    };

    // 构造按键抬起事件
    const keyUpEvent = {
        type: "key",
        data: {
            action: "up",
            keycode: keyCode,
            repeat: 0,
            metastate: 0,
        },
    };

    Log.info(`FollowMode: Broadcasting panel button from ${sourceDeviceId}`, buttonId);
    let targetCount = 0;
    wss?.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            const ws = client as any;
            const clientDeviceId = ws._deviceId;
            const clientType = ws._clientType;
            if (clientType === "DeviceManage" && clientDeviceId && clientDeviceId !== sourceDeviceId) {
                try {
                    // 发送按下和抬起两个事件
                    client.send(JSON.stringify(keyDownEvent));
                    client.send(JSON.stringify(keyUpEvent));
                    targetCount++;
                    Log.info(`FollowMode: Panel button sent to ${clientType}:${clientDeviceId} ${buttonId}->${keyCode}`);
                } catch (error) {
                    Log.error(`FollowMode: Failed to send panel button to ${clientDeviceId}: ${error.message}`);
                }
            }
        }
    });

    if (targetCount === 0) {
        Log.info(`FollowMode: No target devices to forward panel button (source: ${sourceDeviceId})`);
    }
};

// 处理随动模式 - 在main进程中直接转发事件给其他设备，不经过Render进程
const handleFollowMode = (sourceDeviceId: string, eventData: any) => {
    Log.info(`FollowMode: Broadcasting event from ${sourceDeviceId}`, eventData.type);
    let targetCount = 0;
    wss?.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            const ws = client as any;
            const clientDeviceId = ws._deviceId;
            const clientType = ws._clientType;
            if (clientType === "DeviceManage" && clientDeviceId && clientDeviceId !== sourceDeviceId) {
                try {
                    client.send(JSON.stringify(eventData));
                    targetCount++;
                    Log.info(`FollowMode: Event sent to ${clientType}:${clientDeviceId} ${JSON.stringify(eventData)}`);
                } catch (error) {
                    Log.error(`FollowMode: Failed to send event to ${clientDeviceId}: ${error.message}`);
                }
            }
        }
    });

    if (targetCount === 0) {
        Log.info(`FollowMode: No target devices to forward (source: ${sourceDeviceId})`);
    }
};


const stop = () => {
    if (wss) {
        // 先给所有DeviceManage和DeviceMirror发送quit命令
        const quitMessage = JSON.stringify({type: "quit"});
        clients.forEach((clientSet, clientType) => {
            if (clientType === "DeviceManage" || clientType === "DeviceMirror") {
                clientSet.forEach((ws) => {
                    if (ws.readyState === WebSocket.OPEN) {
                        try {
                            ws.send(quitMessage);
                            Log.info(`Sent quit command to ${clientType}`);
                        } catch (error: any) {
                            Log.error(`Failed to send quit command to ${clientType}: ${error.message}`);
                        }
                    }
                });
            }
        });

        // 等待一小段时间确保消息发送完成
        const currentWss = wss;
        setTimeout(() => {
            clients.forEach((clientSet) => {
                clientSet.forEach((ws) => {
                    ws.close();
                });
            });
            clients.clear();
            currentWss.close();
            wss = null;
            Log.info("WebSocket server stopped");
        }, 100);
    }
};

const getPort = (): number => {
    return wsPort;
};

const getAddress = (): string => {
    return `ws://localhost:${wsPort}`;
};

ipcMain.handle("serve:start", async () => {
    return await start();
});

ipcMain.handle("serve:stop", async () => {
    return stop();
});

ipcMain.handle("serve:getPort", async () => {
    return getPort();
});

ipcMain.handle("serve:getAddress", async () => {
    return getAddress();
});

export default {
    start,
    stop,
    getPort,
    getAddress,
    broadcast,
};
