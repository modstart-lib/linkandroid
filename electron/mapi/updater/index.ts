import electronUpdater from 'electron-updater'
import {is} from '@electron-toolkit/utils'
import {app, ipcMain} from "electron";
import {AppRuntime} from "../env";
import {AppConfig} from "../../../src/config";

const {autoUpdater} = electronUpdater
const init = () => {
    if (!AppConfig.updaterUrl) {
        return
    }
    autoUpdater.setFeedURL({
        provider: 'generic',
        url: AppConfig.updaterUrl,
    })
    if (is.dev) {
        Object.defineProperty(app, 'isPackaged', {
            get() {
                return true
            },
        })
    }
}

ipcMain.handle('updater:checkForUpdate', () => {
    autoUpdater.checkForUpdates()
})

// 设置自动下载为false (默认为true，检测到有更新就自动下载)
autoUpdater.autoDownload = false
// 检测下载错误
autoUpdater.on('error', (error) => {
    AppRuntime.mainWindow.webContents.send('updater:error', error)
})
// 检测是否需要更新
autoUpdater.on('checking-for-update', () => {
    AppRuntime.mainWindow.webContents.send('updater:checkingForUpdate')
})
// 检测到可以更新时
autoUpdater.on('update-available', (ret) => {
    AppRuntime.mainWindow.webContents.send('updater:updateAvailable', ret)
})
// 检测到不需要更新时
autoUpdater.on('update-not-available', (ret) => {
    AppRuntime.mainWindow.webContents.send('updater:updateNotAvailable', ret)
})

ipcMain.on('updater:downloadUpdate', () => {
    autoUpdater.downloadUpdate()
})
// 更新下载进度
autoUpdater.on('download-progress', (ret) => {
    AppRuntime.mainWindow.webContents.send('updater:downloadProgress', ret)
})
// 当需要更新的内容下载完成后
autoUpdater.on('update-downloaded', (ret) => {
    AppRuntime.mainWindow.webContents.send('updater:updateDownloaded', ret)
})

// 安装更新
ipcMain.on('updater:quitAndInstall', () => {
    setImmediate(() => {
        app['isQuiting'] = true
        autoUpdater.quitAndInstall()
    })
})

export default {
    init
}
