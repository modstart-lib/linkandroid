import {dialog, ipcMain, shell} from "electron";
import fileIndex from "./index";

ipcMain.handle('file:openFile', async (_, options) => {
    const res = await dialog
        .showOpenDialog({
            properties: ['openFile'],
            ...options
        })
        .catch(e => {
        })
    if (!res || res.canceled) {
        return null
    }
    return res.filePaths?.[0] || null
})

ipcMain.handle('file:openDirectory', async (_, options) => {
    const res = await dialog
        .showOpenDialog({
            properties: ['openDirectory'],
            ...options
        })
        .catch(e => {
        })
    if (!res || res.canceled) {
        return null
    }
    return res.filePaths?.[0] || null
})

ipcMain.handle('file:openSave', async (_, options) => {
    const res = await dialog
        .showSaveDialog({
            ...options
        })
        .catch(e => {
        })
    if (!res || res.canceled) {
        return null
    }
    return res.filePath || null
})

ipcMain.handle('file:openPath', async (_, path, options) => {
    return shell.openPath(path)
})

export default {
    ...fileIndex,
}

export const Files = {
    ...fileIndex
}
