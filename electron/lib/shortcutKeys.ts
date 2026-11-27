// 快捷键键位工具：主进程与渲染进程共用，只包含纯函数
export const SHORTCUT_CONFIG_KEY = 'Device.shortcuts'

export const SHORTCUT_MODIFIERS = ['Ctrl', 'Alt', 'Shift', 'Super']

const CODE_TO_KEY: Record<string, string> = {
    Space: 'Space',
    Enter: 'Enter',
    NumpadEnter: 'Enter',
    Tab: 'Tab',
    Escape: 'Escape',
    Backspace: 'Backspace',
    Delete: 'Delete',
    Insert: 'Insert',
    Home: 'Home',
    End: 'End',
    PageUp: 'PageUp',
    PageDown: 'PageDown',
    ArrowUp: 'Up',
    ArrowDown: 'Down',
    ArrowLeft: 'Left',
    ArrowRight: 'Right',
    Minus: '-',
    Equal: '=',
    BracketLeft: '[',
    BracketRight: ']',
    Semicolon: ';',
    Quote: "'",
    Comma: ',',
    Period: '.',
    Slash: '/',
    Backslash: '\\',
    Backquote: '`',
}

const SUPPORTED_KEYS = [
    'Space',
    'Enter',
    'Tab',
    'Escape',
    'Backspace',
    'Delete',
    'Insert',
    'Home',
    'End',
    'PageUp',
    'PageDown',
    'Up',
    'Down',
    'Left',
    'Right',
    '-',
    '=',
    '[',
    ']',
    ';',
    "'",
    ',',
    '.',
    '/',
    '\\',
    '`',
]

// 把 KeyboardEvent.code 映射成 scrcpy 认识的键名
export const codeToKeyName = (code: string): string | null => {
    if (CODE_TO_KEY[code]) {
        return CODE_TO_KEY[code]
    }
    let matched = code.match(/^Digit([0-9])$/)
    if (matched) {
        return matched[1]
    }
    matched = code.match(/^(?:Key|Numpad)([A-Z0-9])$/)
    if (matched) {
        return matched[1]
    }
    matched = code.match(/^F([1-9]|1[0-2])$/)
    if (matched) {
        return 'F' + matched[1]
    }
    return null
}

export const isSupportedKey = (key: string): boolean => {
    if (/^[0-9]$/.test(key) || /^[A-Z]$/.test(key) || /^F([1-9]|1[0-2])$/.test(key)) {
        return true
    }
    return SUPPORTED_KEYS.includes(key)
}

export const parseKeys = (keys: string): {mods: string[]; key: string} | null => {
    if (!keys) {
        return null
    }
    const parts = keys.split('+').filter((item) => item)
    if (parts.length < 2) {
        return null
    }
    const key = parts.pop() as string
    const mods: string[] = []
    for (const part of parts) {
        if (!SHORTCUT_MODIFIERS.includes(part)) {
            return null
        }
        if (!mods.includes(part)) {
            mods.push(part)
        }
    }
    if (!mods.length) {
        return null
    }
    return {mods, key}
}

// 必须带修饰键，且主键受支持，否则会吞掉手机的正常输入
export const isValidKeys = (keys: string): boolean => {
    const parsed = parseKeys(keys)
    return !!parsed && isSupportedKey(parsed.key)
}

// 从键盘事件生成 "Alt+1" 形式的键位串
export const keysFromEvent = (event: KeyboardEvent): string | null => {
    const mods: string[] = []
    if (event.ctrlKey) mods.push('Ctrl')
    if (event.altKey) mods.push('Alt')
    if (event.shiftKey) mods.push('Shift')
    if (event.metaKey) mods.push('Super')
    const key = codeToKeyName(event.code)
    if (!key || !mods.length) {
        return null
    }
    return [...mods, key].join('+')
}
