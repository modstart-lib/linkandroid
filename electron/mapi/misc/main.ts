import {ipcMain} from "electron";

import index from './index'

ipcMain.handle('misc:getZipFileContent', async (_, path: string, pathInZip: string) => {
    return await index.getZipFileContent(path, pathInZip)
})
ipcMain.handle('misc:unzip', async (_, zipPath: string, dest: string) => {
    return await index.unzip(zipPath, dest)
})

export default {
    ...index,
}

export const MiscMain = {
    ...index
}
