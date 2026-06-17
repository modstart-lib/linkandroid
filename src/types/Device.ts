import {ComputedRef} from 'vue'

export enum EnumDeviceStatus {
    WAIT_CONNECTING = 'waitConnecting',
    CONNECTED = 'connected',
    DISCONNECTED = 'disconnected',
}

export enum EnumDeviceType {
    USB = 'usb',
    WIFI = 'wifi',
}

export type DeviceRaw = {
    id: string
    type?: string
    model?: string
    [key: string]: unknown
}

export type DeviceSetting = {
    dimWhenMirror?: string
    alwaysTop?: string
    mirrorSound?: string
    previewImage?: string
    videoBitRate?: string
    maxFps?: string
    scrcpyArgs?: string
    panelShow?: string
    powerSaveBlock?: string
    windowBorderless?: string
}

export type ShellController = {
    stop: () => void
    send: (data: string) => void
    result: () => Promise<string>
}

export type DeviceRecord = {
    id: string
    type: EnumDeviceType
    name: string | null
    raw: DeviceRaw

    status?: any
    runtime?: any
    screenshot?: string | null
    setting?: DeviceSetting
}

export type DeviceRuntime = {
    status: EnumDeviceStatus
    mirrorController: ShellController | null
    screenBrightness?: number
    previewImage: string
}

export type DeviceGroup = {
    id: string
    name: string
    deviceIds: string[]
}
