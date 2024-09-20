import {dialog, ipcMain} from "electron";
import fileIndex from "./index";

ipcMain.handle('file:openFile', async (_, options) => {
    const res = await dialog
        .showOpenDialog(options)
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

export default {
    ...fileIndex,
}

export const Files = {
    ...fileIndex
}
