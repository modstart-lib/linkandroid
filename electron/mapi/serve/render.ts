import {ipcRenderer} from 'electron'

const start = async (): Promise<number> => {
    return await ipcRenderer.invoke('serve:start')
}

const stop = async () => {
    return await ipcRenderer.invoke('serve:stop')
}

const getPort = async (): Promise<number> => {
    return await ipcRenderer.invoke('serve:getPort')
}

const getAddress = async (): Promise<string> => {
    return await ipcRenderer.invoke('serve:getAddress')
}

const shortcutsSync = async (): Promise<boolean> => {
    return await ipcRenderer.invoke('serve:shortcutsSync')
}

export default {
    start,
    stop,
    getPort,
    getAddress,
    shortcutsSync,
}
