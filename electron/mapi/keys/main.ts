import {app, BrowserWindow, globalShortcut} from "electron";
import {AppsMain} from "../app/main";

const eventListeners = {}

// 连续点击的快捷键
let continuousKeys = []
const addKeyInput = (key: string, expire = 1000) => {
    let now = Date.now()
    continuousKeys.push({key, expire: now + expire})
    continuousKeys = continuousKeys.filter(item => item.expire > now)
    for (let i = continuousKeys.length - 1; i >= 0; i--) {
        const key = continuousKeys.filter((o, oIndex) => oIndex >= i).map(o => o.key).join('|')
        if (eventListeners[key]) {
            eventListeners[key]()
            break
        }
    }
}

const addMultiKeyListener = (keys: string[], callback: Function) => {
    if (!Array.isArray(keys)) {
        keys = [keys]
    }
    const key = keys.join('|')
    eventListeners[key] = callback
}

const createKeyInputListener = (key: string) => {
    return () => {
        addKeyInput(key)
    }
}

const keyMap = {
    'CommandOrControl+Shift+H': createKeyInputListener('CommandOrControl+Shift+H'),
}

const ready = () => {
    register()
}

const destroy = () => {
    globalShortcut.unregisterAll();
}

const register = () => {

    globalShortcut.unregisterAll();

    app.on('browser-window-focus', () => {
        for (let key in keyMap) {
            globalShortcut.register(key, keyMap[key])
        }
    });

    app.on('browser-window-blur', () => {
        for (let key in keyMap) {
            globalShortcut.unregister(key)
        }
    })

    addMultiKeyListener([
        'CommandOrControl+Shift+H', 'CommandOrControl+Shift+H', 'CommandOrControl+Shift+H'
    ], () => {
        let focusedWindow = BrowserWindow.getFocusedWindow();
        if (focusedWindow) {
            if (focusedWindow.webContents.isDevToolsOpened()) {
                focusedWindow.webContents.closeDevTools();
            } else {
                focusedWindow.webContents.openDevTools({
                    mode: 'detach',
                    activate: false,
                    title: 'FocusedWindow',
                });
            }
        }
    });
}

export const KeysMain = {
    register
}

export default {
    ready,
    destroy,
}

