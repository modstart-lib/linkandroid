import { Bonjour } from "bonjour-service";
import { BrowserWindow, ipcMain } from "electron";
import { spawn } from "node:child_process";
import net from "node:net";
import { extraResolveBin } from "../../lib/env";

const MDNS_CONFIG = {
    PAIRING_TYPE: "adb-tls-pairing",
    PAIRING_TYPE_ALT: "_adb-tls-pairing._tcp",
    CONNECT_TYPE: "adb-tls-connect",
    CONNECT_TYPE_ALT: "_adb-tls-connect._tcp",
    DEFAULT_TIMEOUT: 60 * 1000,
    CONNECT_TIMEOUT: 30 * 1000,
};

const ERROR_CODES = {
    TIMEOUT: "TIMEOUT",
    PAIRING_FAILED: "PAIRING_FAILED",
    CONNECTION_FAILED: "CONNECTION_FAILED",
    INVALID_PARAMS: "INVALID_PARAMS",
};

interface DeviceData {
    name: string;
    address: string;
    port: number;
}

class MonitorError extends Error {
    code: string;

    constructor(code: string, message: string) {
        super(message);
        this.code = code;
    }
}

class DeviceScanner {
    private bonjour: any = null;
    private scanner: any = null;

    startScanning(type: string, callback: (device: DeviceData) => void) {
        console.log("[Main] DeviceScanner.startScanning 初始化 Bonjour...");
        this.bonjour = new Bonjour();

        console.log(`[Main] DeviceScanner.startScanning 开始查找服务类型: ${type}`);
        this.scanner = this.bonjour.find({type}, (service: any) => {
            console.log("[Main] DeviceScanner 发现服务:", JSON.stringify({
                name: service.name,
                type: service.type,
                addresses: service.addresses,
                port: service.port,
                host: service.host
            }));

            const device = this.fromMdnsService(service);
            if (device) {
                console.log("[Main] DeviceScanner 解析成功的设备:", device);
                callback(device);
            } else {
                console.log("[Main] DeviceScanner 解析设备失败 (可能没有 IPv4 地址)");
            }
        });

        // 添加错误处理
        if (this.scanner) {
            this.scanner.on('error', (err: any) => {
                console.error("[Main] Bonjour scanner 错误:", err);
            });
        }

        console.log("[Main] DeviceScanner.startScanning 已启动，等待服务广播...");
    }

    private fromMdnsService(service: any): DeviceData | null {
        const ipv4Address = service.addresses?.find((addr: string) => net.isIP(addr) === 4);
        if (!ipv4Address) {
            return null;
        }

        return {
            name: service.name,
            address: ipv4Address,
            port: service.port,
        };
    }

    dispose() {
        console.log("[Main] DeviceScanner.dispose 清理资源...");
        if (this.scanner) {
            this.scanner.stop();
            this.scanner = null;
        }
        if (this.bonjour) {
            this.bonjour.destroy();
            this.bonjour = null;
        }
    }
}

class AdbScanner {
    private deviceScanner: DeviceScanner = new DeviceScanner();
    private isActive = false;
    private window: BrowserWindow | null = null;
    private callbackId: string = "";

    async connect(window: BrowserWindow, callbackId: string, password: string) {
        this.window = window;
        this.callbackId = callbackId;

        if (!password) {
            this.sendStatus("error", "Password is required");
            return {success: false, error: "Password is required"};
        }

        this.isActive = true;

        try {
            console.log("[Main] 开始配对流程...");
            this.sendStatus("pairing");
            const device = await this.scanForDevice();
            await this.pairWithDevice(device, password);

            this.sendStatus("connecting");

            try {
                const connectDevice = await this.waitForDeviceConnect(device);
                await this.connectToDevice(connectDevice);
            } catch (error) {
                console.log("[Main] 标准连接失败，尝试备用端口 5555");
                this.sendStatus("connecting-fallback");
                await this.connectToDevice({
                    ...device,
                    port: 5555,
                });
            }

            this.sendStatus("connected");

            return {
                success: true,
                device,
            };
        } catch (error: any) {
            console.error("[Main] 配对失败:", error);
            this.sendStatus("error", error.message);
            return {
                success: false,
                error: error.message,
            };
        } finally {
            this.dispose();
        }
    }

    private sendStatus(status: string, error?: string) {
        try {
            if (this.window && !this.window.isDestroyed() && this.callbackId) {
                const webContents = this.window.webContents;
                if (webContents && !webContents.isDestroyed() && !webContents.isCrashed()) {
                    webContents.send(`adb-scanner-status-${this.callbackId}`, {status, error});
                    console.log(`[Main] 发送状态更新: ${status}`, error || "");
                }
            }
        } catch (error) {
            console.error("[Main] 发送状态更新失败:", error);
        }
    }

    private async scanForDevice(): Promise<DeviceData> {
        console.log("[Main] 开始扫描 mDNS 服务:", MDNS_CONFIG.PAIRING_TYPE, "和", MDNS_CONFIG.PAIRING_TYPE_ALT);

        // 同时启动一个通用扫描，看看能发现什么服务
        const debugBonjour = new Bonjour();

        // 尝试扫描所有服务（仅用于调试）
        console.log("[Main] 同时启动全局服务扫描（调试用）...");
        const allServicesScanner = debugBonjour.find({type: ''}, (service: any) => {
            if (service.type && (service.type.includes('adb') || service.type.includes('ADB'))) {
                console.log("[Main] 发现 ADB 相关服务:", JSON.stringify({
                    name: service.name,
                    type: service.type,
                    addresses: service.addresses,
                    port: service.port
                }));
            }
        });

        return new Promise((resolve, reject) => {
            let deviceFound = false;

            const timeoutHandle = setTimeout(() => {
                if (!deviceFound) {
                    console.log("[Main] 扫描超时，未发现设备");
                    // 清理调试扫描器
                    if (allServicesScanner) allServicesScanner.stop();
                    if (debugBonjour) debugBonjour.destroy();
                    this.dispose();
                    // 同时清理备用扫描器
                    if (altScanner) altScanner.dispose();
                    reject(
                        new MonitorError(
                            ERROR_CODES.TIMEOUT,
                            "Connection attempt timed out"
                        )
                    );
                }
            }, MDNS_CONFIG.DEFAULT_TIMEOUT);

            const handleDeviceFound = (device: DeviceData) => {
                if (!deviceFound) {
                    deviceFound = true;
                    console.log("[Main] 发现设备:", device);
                    clearTimeout(timeoutHandle);
                    // 清理调试扫描器
                    if (allServicesScanner) allServicesScanner.stop();
                    if (debugBonjour) debugBonjour.destroy();
                    // 清理备用扫描器
                    if (altScanner) altScanner.dispose();
                    resolve(device);
                }
            };

            // 主扫描器
            this.deviceScanner.startScanning(
                MDNS_CONFIG.PAIRING_TYPE,
                handleDeviceFound
            );

            // 备用扫描器（使用标准格式）
            const altScanner = new DeviceScanner();
            altScanner.startScanning(
                MDNS_CONFIG.PAIRING_TYPE_ALT,
                handleDeviceFound
            );
        });
    }

    private async pairWithDevice(device: DeviceData, password: string) {
        try {
            const adbPath = await extraResolveBin("scrcpy/adb");

            console.log(`[Main] 执行配对命令: ${adbPath} pair ${device.address}:${device.port}`);

            return new Promise<void>((resolve, reject) => {
                const process = spawn(adbPath, ["pair", `${device.address}:${device.port}`, password]);

                let stdout = "";
                let stderr = "";

                process.stdout?.on("data", (data) => {
                    const text = data.toString();
                    console.log("[Main] adb pair stdout:", text);
                    stdout += text;
                    if (stdout.includes("Successfully paired")) {
                        console.log("[Main] 配对成功");
                        resolve();
                    }
                });

                process.stderr?.on("data", (data) => {
                    const text = data.toString();
                    console.log("[Main] adb pair stderr:", text);
                    stderr += text;
                    if (stderr.includes("Successfully paired")) {
                        console.log("[Main] 配对成功");
                        resolve();
                    }
                });

                process.on("close", (code) => {
                    console.log(`[Main] adb pair 进程退出，代码: ${code}`);
                    if (stdout.includes("Successfully paired") || stderr.includes("Successfully paired")) {
                        resolve();
                    } else {
                        reject(new Error(`Pairing failed with code ${code}: ${stderr || stdout}`));
                    }
                });

                process.on("error", (error) => {
                    console.error("[Main] adb pair 进程错误:", error);
                    reject(error);
                });
            });
        } catch (error) {
            console.error("[Main] 配对设备失败:", error);
            throw new MonitorError(
                ERROR_CODES.PAIRING_FAILED,
                "Unable to pair with device"
            );
        }
    }

    private async waitForDeviceConnect(device: DeviceData): Promise<DeviceData> {
        console.log("[Main] 等待设备连接服务广播...");
        return new Promise((resolve, reject) => {
            let deviceFound = false;
            const scanner = new DeviceScanner();
            const altScanner = new DeviceScanner();

            const timeoutHandle = setTimeout(() => {
                if (!deviceFound) {
                    console.log("[Main] 等待设备连接超时");
                    scanner.dispose();
                    altScanner.dispose();
                    reject(
                        new MonitorError(
                            ERROR_CODES.TIMEOUT,
                            "Device connect timeout"
                        )
                    );
                }
            }, MDNS_CONFIG.CONNECT_TIMEOUT);

            const handleConnect = (connectDevice: DeviceData) => {
                if (!deviceFound && connectDevice.address === device.address) {
                    deviceFound = true;
                    console.log("[Main] 发现连接服务:", connectDevice);
                    clearTimeout(timeoutHandle);
                    scanner.dispose();
                    altScanner.dispose();
                    resolve(connectDevice);
                }
            };

            scanner.startScanning(MDNS_CONFIG.CONNECT_TYPE, handleConnect);
            altScanner.startScanning(MDNS_CONFIG.CONNECT_TYPE_ALT, handleConnect);
        });
    }

    private async connectToDevice(device: DeviceData) {
        try {
            const adbPath = await extraResolveBin("scrcpy/adb");
            console.log(`[Main] 执行连接命令: ${adbPath} connect ${device.address}:${device.port}`);

            return new Promise<void>((resolve, reject) => {
                const process = spawn(adbPath, ["connect", `${device.address}:${device.port}`]);

                let stdout = "";
                let stderr = "";

                process.stdout?.on("data", (data) => {
                    stdout += data.toString();
                });

                process.stderr?.on("data", (data) => {
                    stderr += data.toString();
                });

                process.on("close", (code) => {
                    console.log(`[Main] adb connect 输出: ${stdout}${stderr}`);
                    if (code === 0 || stdout.includes("connected")) {
                        resolve();
                    } else {
                        reject(new Error(`Connection failed: ${stderr || stdout}`));
                    }
                });

                process.on("error", (error) => {
                    reject(error);
                });
            });
        } catch (error: any) {
            throw new MonitorError(
                ERROR_CODES.CONNECTION_FAILED,
                `Failed to connect to device: ${error.message}`
            );
        }
    }

    private dispose() {
        console.log("[Main] AdbScanner.dispose 清理资源...");
        this.deviceScanner.dispose();
        this.isActive = false;
    }
}

// IPC Handler
ipcMain.handle("adb:scannerConnect", async (event, password: string, callbackId: string) => {
    console.log("[Main] 收到 scannerConnect 请求, password:", password, "callbackId:", callbackId);

    try {
        const scanner = new AdbScanner();
        const window = BrowserWindow.fromWebContents(event.sender);
        if (!window) {
            console.error("[Main] 无法找到发送请求的窗口");
            return {success: false, error: "Window not found"};
        }

        if (window.isDestroyed()) {
            console.error("[Main] 窗口已销毁");
            return {success: false, error: "Window destroyed"};
        }

        console.log("[Main] 开始执行扫描连接...");
        return await scanner.connect(window, callbackId, password);
    } catch (error: any) {
        console.error("[Main] scannerConnect 处理失败:", error);
        return {success: false, error: error.message || String(error)};
    }
});

export default {};
