import {ipcRenderer} from "electron";


let checkForUpdateCallback = null as (type: 'error' | 'checking' | 'available' | 'notAvailable', data: any) => void
const checkForUpdate = (callback: Function) => {
    checkForUpdateCallback = callback as any
    ipcRenderer.invoke('updater:checkForUpdate')
}
ipcRenderer.on('updater:error', (event, ret) => {
    if (checkForUpdateCallback) {
        checkForUpdateCallback('error', ret)
        checkForUpdateCallback = null
    }
})
ipcRenderer.on('updater:checkingForUpdate', (event) => {
    if (checkForUpdateCallback) {
        checkForUpdateCallback('checking', null)
    }
})
ipcRenderer.on('updater:updateAvailable', (event, ret) => {
    if (checkForUpdateCallback) {
        checkForUpdateCallback('available', ret)
        checkForUpdateCallback = null
    }
})
ipcRenderer.on('updater:updateNotAvailable', (event, ret) => {
    if (checkForUpdateCallback) {
        checkForUpdateCallback('notAvailable', ret)
        checkForUpdateCallback = null
    }
})


let downloadUpdateCallback = null as (type: 'error' | 'progress' | 'downloaded', data: any) => void
const downloadUpdate = (callback: Function) => {
    ipcRenderer.send('updater:downloadUpdate')
    downloadUpdateCallback = callback as any
}

ipcRenderer.on('updater:downloadProgress', (event, ret) => {
    if (downloadUpdateCallback) {
        downloadUpdateCallback('progress', ret)
    }
})
ipcRenderer.on('updater:updateDownloaded', (event, ret) => {
    if (downloadUpdateCallback) {
        downloadUpdateCallback('downloaded', ret)
        downloadUpdateCallback = null
    }
})

const quickAndUpdate = () => {
    ipcRenderer.send('updater:quitAndInstall')
}

export default {
    checkForUpdate,
    downloadUpdate,
    quickAndUpdate
}
