import {ipcMain, powerSaveBlocker} from 'electron'

let blockerId: number | null = null

ipcMain.handle('powerSaveBlock:start', (_event, reason: 'prevent-app-suspension' | 'prevent-display-sleep') => {
    if (blockerId !== null) {
        powerSaveBlocker.stop(blockerId)
    }
    blockerId = powerSaveBlocker.start(reason || 'prevent-display-sleep')
    return blockerId
})

ipcMain.handle('powerSaveBlock:stop', () => {
    if (blockerId !== null) {
        powerSaveBlocker.stop(blockerId)
        blockerId = null
    }
    return true
})

ipcMain.handle('powerSaveBlock:isStarted', () => {
    return blockerId !== null && powerSaveBlocker.isStarted(blockerId)
})

export default {}
