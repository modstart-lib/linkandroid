import {app, BrowserWindow, ipcMain, screen, shell, clipboard, nativeImage, nativeTheme} from "electron";
import {WindowConfig} from "../../config/window";
import {AppRuntime} from "../env";
import {isMac} from "../../lib/env";
import {AppPosition} from "./lib/position";
import {Events} from "../event/main";
import {ConfigMain} from "../config/main";
import {CommonConfig} from "../../config/common";


const getWindowByName = (name?: string) => {
    if (!name || 'main' === name) {
        return AppRuntime.mainWindow
    }
    return AppRuntime.windows[name]
}

const getCurrentWindow = (window, e) => {
    let originWindow = BrowserWindow.fromWebContents(e.sender);
    // if (originWindow !== window) originWindow = detachInstance.getWindow();
    return originWindow;
}


const quit = () => {
    app.quit()
}

const windowMin = (name?: string) => {
    getWindowByName(name)?.minimize()
}

const windowMax = (name?: string) => {
    const win = getWindowByName(name)
    if (!win) {
        return
    }
    if (win.isFullScreen()) {
        win.setFullScreen(false)
        win.unmaximize()
        win.center()
    } else if (win.isMaximized()) {
        win.unmaximize()
        win.center()
    } else {
        win.setMinimumSize(WindowConfig.minWidth, WindowConfig.minHeight)
        win.maximize()
    }
}

const windowSetSize = (name: string | null, width: number, height: number, option?: {
    includeMinimumSize: boolean,
    center: boolean
}) => {
    width = parseInt(String(width))
    height = parseInt(String(height))
    // console.log('windowSetSize', name, width, height, option)
    const win = getWindowByName(name)
    if (!win) {
        return
    }
    option = Object.assign({
        includeMinimumSize: true,
        center: true
    }, option)
    if (option.includeMinimumSize) {
        win.setMinimumSize(width, height)
    }
    win.setSize(width, height)
    if (option.center) {
        win.center()
    }
}

ipcMain.handle('app:quit', () => {
    quit()
})

ipcMain.handle('app:openExternalWeb', (event, url: string) => {
    return shell.openExternal(url)
})

ipcMain.handle('window:min', (event, name: string) => {
    windowMin(name)
})
ipcMain.handle('window:max', (event, name: string) => {
    windowMax(name)
})
ipcMain.handle('window:setSize', (event, name: string | null, width: number, height: number, option?: {
    includeMinimumSize: boolean,
    center: boolean
}) => {
    windowSetSize(name, width, height, option)
})

ipcMain.handle('window:close', (event, name: string) => {
    getWindowByName(name)?.close()
})

ipcMain.handle('window:hide', (event, name: string) => {
    getWindowByName(name)?.hide()
    if (isMac) {
        app.dock.hide()
    }
})

ipcMain.handle('window:move', (event, name: string | null, data: {
    mouseX: number,
    mouseY: number,
    width: number,
    height: number
}) => {
    const {x, y} = screen.getCursorScreenPoint();
    const originWindow = getWindowByName(name);
    if (!originWindow) return;
    originWindow.setBounds({x: x - data.mouseX, y: y - data.mouseY, width: data.width, height: data.height});
    AppPosition.set(name, x - data.mouseX, y - data.mouseY);
})


const getClipboardText = () => {
    return clipboard.readText('clipboard')
}

ipcMain.handle('app:getClipboardText', (event) => {
    return getClipboardText()
})

const setClipboardText = (text: string) => {
    clipboard.writeText(text, 'clipboard')
}

ipcMain.handle('app:setClipboardText', (event, text: string) => {
    setClipboardText(text)
})

const getClipboardImage = () => {
    const image = clipboard.readImage('clipboard')
    return image.isEmpty() ? '' : image.toDataURL()
}

ipcMain.handle('app:getClipboardImage', (event) => {
    return getClipboardImage()
})

const setClipboardImage = (image: string) => {
    const img = nativeImage.createFromDataURL(image)
    clipboard.writeImage(img, 'clipboard')
}

ipcMain.handle('app:setClipboardImage', (event, image: string) => {
    setClipboardImage(image)
})

const isDarkMode = () => {
    if (!CommonConfig.darkModeEnable) {
        return false;
    }
    return nativeTheme.shouldUseDarkColors
}

const shouldDarkMode = async () => {
    if (!CommonConfig.darkModeEnable) {
        return false;
    }
    const darkMode = (await ConfigMain.get('darkMode')) || 'auto'
    if ('dark' === darkMode) {
        return true
    } else if ('light' === darkMode) {
        return false
    } else if ('auto' === darkMode) {
        return isDarkMode()
    }
    return false
}

const defaultDarkModeBackgroundColor = async () => {
    if (await shouldDarkMode()) {
        return '#1A202C'
    }
    return '#FFFFFF'
}

nativeTheme.on('updated', () => {
    Events.broadcast('DarkModeChange', {isDarkMode: isDarkMode()})
})

ipcMain.handle('app:isDarkMode', () => {
    return isDarkMode()
})

export default {
    quit
}

export const AppsMain = {
    shouldDarkMode,
    defaultDarkModeBackgroundColor,
    getWindowByName,
    getClipboardText,
    setClipboardText,
    getClipboardImage,
    setClipboardImage,
}
