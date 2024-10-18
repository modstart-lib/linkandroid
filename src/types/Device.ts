export enum EnumDeviceStatus {
    WAIT_CONNECTING = 'waitConnecting',
    CONNECTED = 'connected',
    DISCONNECTED = 'disconnected',
}

export enum EnumDeviceType {
    USB = 'usb',
    WIFI = 'wifi',
}

export type DeviceRecord = {
    id: string,
    type: EnumDeviceType,
    name: string | null,
    raw: any,

    status?: any,
    runtime?: any,
    screenshot?: string | null,
    setting?: {
        dimWhenMirror: boolean,
        alwaysTop: boolean,
        mirrorSound: boolean,
    },
}

export type DeviceRuntime = {
    status: EnumDeviceStatus,
    mirrorController: any,
    screenBrightness?: number,
}
