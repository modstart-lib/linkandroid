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
    status: EnumDeviceStatus,
    name: string | null,
    screenshot: string | null,
    raw: any
}


