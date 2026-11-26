import {ipcMain} from 'electron'

import index from './index'

ipcMain.handle('misc:getZipFileContent', async (_, path: string, pathInZip: string) => {
    return await index.getZipFileContent(path, pathInZip)
})
ipcMain.handle('misc:unzip', async (_, zipPath: string, dest: string) => {
    return await index.unzip(zipPath, dest)
})
ipcMain.handle('misc:zip', async (_, zipPath: string, sourceDir: string, option?: any) => {
    return await index.zip(zipPath, sourceDir, option)
})
ipcMain.handle('misc:getNetworkInterfaces', async () => {
    return index.getNetworkInterfaces()
})

export default {
    ...index,
}

export const MiscMain = {
    ...index,
}
