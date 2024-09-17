import {app, ipcMain} from "electron";
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
ipcMain.handle('window:min', () => {
    windowMin()
})
ipcMain.handle('window:max', () => {
    windowMax()
})
ipcMain.handle('window:setSize', (event, width: number, height: number) => {
    windowSetSize(width, height)
})

export default {
    quit
}
