export enum HotkeyMouseButtonEnum {
    LEFT = 1,
    RIGHT = 2
}

export type HotkeyKeyItem = {
    key: string
    // Alt Option
    altKey: boolean
    // Ctrl Control
    ctrlKey: boolean
    // Command Win
    metaKey: boolean
    // Shift
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
