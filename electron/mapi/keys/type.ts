export enum HotkeyMouseButtonEnum {
    LEFT = 1,
    RIGHT = 2
}

export type HotkeyKeyItem = {
    key: string
    altKey: boolean
    ctrlKey: boolean
    metaKey: boolean
    shiftKey: boolean
    times: number
}

export type HotkeyKeySimpleItem = {
    type: 'Ctrl' | 'Alt' | 'Meta'
}

export type HotkeyMouseItem = {
    button: HotkeyMouseButtonEnum
    type: 'click' | 'longPress'
    clickTimes?: number
}
