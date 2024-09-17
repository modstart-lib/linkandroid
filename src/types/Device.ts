export enum EnumDeviceStatus {
    WAIT_CONNECTING = 'waitConnecting',
    CONNECTED = 'connected',
    DISCONNECTED = 'disconnected',
}

export type DeviceRecord = {
    id: string,
    status: EnumDeviceStatus,
    name: string | null,
    screenshot: string | null,
    raw: any
}


