import { ipcMain } from "electron";
import { WebSocket, WebSocketServer } from "ws";
import { Apps } from "../app";
import { Log } from "../log/main";

let wss: WebSocketServer | null = null;
let wsPort: number = 10667;
const clients: Map<string, Set<WebSocket>> = new Map(); // DeviceManage | DeviceMirror | Render
const deviceStates: Map<string, any> = new Map(); // 存储设备状态

const panelConfig = {
    type: "panel",
    data: {
        buttons: [
            {id: "home", text: "首页"},
            {id: "back", text: "返回"},
            {id: "recent", text: "最近"},
            {id: "volume_up", text: "声音+"},
            {id: "volume_down", text: "声音-"},
            {id: "screenshot", text: "截图"},
        ],
    },
};

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

            Log.info(`WebSocket client connected: type=${clientType}, deviceId=${deviceId}`);

            if (!clients.has(clientType)) {
                clients.set(clientType, new Set());
            }
            clients.get(clientType)!.add(ws);

            if (clientType === "DeviceMirror") {
                setTimeout(() => {
                    ws.send(JSON.stringify(panelConfig));
                    Log.info(`Sent panel config to DeviceMirror: deviceId=${deviceId}`);
                }, 1000)
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
                try {
                    const data = JSON.parse(message.toString());
                    if (clientType === "DeviceManage") {
                        if (data.type === "preview") {
                            broadcast("Render", {
                                type: "DevicePreview",
                                id: deviceId,
                                data: data.data,
                            });
                        } else {
                            Log.info(`${clientType}.msg.${deviceId}`, data);
                        }
                    }
                    if (clientType === "DeviceMirror") {
                        if (data.type === "panel_button_click") {
                            data.deviceId = deviceId;
                            data.type = "DevicePanelButtonClick";
                            broadcast("Render", data);
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

const stop = () => {
    if (wss) {
        clients.forEach((clientSet) => {
            clientSet.forEach((ws) => {
                ws.close();
            });
        });
        clients.clear();
        wss.close();
        wss = null;
        Log.info("WebSocket server stopped");
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
