import {BrowserWindow, globalShortcut} from "electron";

const eventListeners = {}

// 连续点击的快捷键
let continuousKeys = []
const addKey = (key, expire = 1000) => {
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

const addKeyListener = (keys, callback) => {
    if (!Array.isArray(keys)) {
        keys = [keys]
    }
    const key = keys.join('|')
    eventListeners[key] = callback
}

const ready = () => {

    addKeyListener(['CommandOrControl+M', 'CommandOrControl+O'], () => {
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

    globalShortcut.register('CommandOrControl+M', () => {
        addKey('CommandOrControl+M')
    });
    globalShortcut.register('CommandOrControl+O', () => {
        addKey('CommandOrControl+O')
    });

}

const destroy = () => {
    globalShortcut.unregisterAll();
}

export default {
    ready,
    destroy,
}
