import {BrowserWindow, globalShortcut, app} from "electron";

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
    'CommandOrControl+L': createKeyInputListener('CommandOrControl+L'),
    'CommandOrControl+A': createKeyInputListener('CommandOrControl+A'),
    'CommandOrControl+C': createKeyInputListener('CommandOrControl+C'),
}

const ready = () => {

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
        'CommandOrControl+L', 'CommandOrControl+A', 'CommandOrControl+C'
    ], () => {
        let focusedWindow = BrowserWindow.getFocusedWindow();
        if (focusedWindow) {
            if (focusedWindow.webContents.isDevToolsOpened()) {
                focusedWindow.webContents.closeDevTools();
            } else {
                focusedWindow.webContents.openDevTools({
                    mode: 'detach',
                });
            }
        }
    });

}

const destroy = () => {
    globalShortcut.unregisterAll();
}

export default {
    ready,
    destroy,
}
