import {app, ipcMain, shell} from "electron";
import {WindowConstant} from "../../lib/constant";
import {AppRuntime} from "../env";

const quit = () => {
    app.quit()
}

const windowMin = () => {
    AppRuntime.mainWindow?.minimize()
}

const windowMax = () => {
    if (AppRuntime.mainWindow.isMaximized()) {
        AppRuntime.mainWindow.unmaximize()
        AppRuntime.mainWindow.center()
    } else {
        AppRuntime.mainWindow.setMinimumSize(WindowConstant.minWidth, WindowConstant.minHeight)
        AppRuntime.mainWindow.maximize()
    }
}

const windowSetSize = (width: number, height: number) => {
    AppRuntime.mainWindow.setMinimumSize(width, height)
    AppRuntime.mainWindow.setSize(width, height)
    AppRuntime.mainWindow.center()
}

ipcMain.handle('app:quit', () => {
    quit()
})

ipcMain.handle('app:openExternalWeb', (event, url: string) => {
    return shell.openExternal(url)
})

ipcMain.handle('window:min', () => {
    windowMin()
})
ipcMain.handle('window:max', () => {
    windowMax()
})
ipcMain.handle('window:setSize', (event, width: number, height: number) => {
    windowSetSize(width, height)
})

ipcMain.handle('window:close', (event, name: string) => {
    if (!name || 'main' === name) {
        AppRuntime.mainWindow?.close()
    } else {
        AppRuntime.windows[name]?.close()
    }
})

ipcMain.handle('window:hide', (event, name: string) => {
    if (!name || 'main' === name) {
        AppRuntime.mainWindow?.hide()
    } else {
        AppRuntime.windows[name]?.hide()
    }
})

export default {
    quit
}
