import {ipcRenderer} from 'electron'

const start = async (serverInfo: ServerInfo) => {
    return ipcRenderer.invoke('server:start', serverInfo)
}

const ping = async (serverInfo: ServerInfo) => {
    return ipcRenderer.invoke('server:ping', serverInfo)
}

const stop = async (serverInfo: ServerInfo) => {
    return ipcRenderer.invoke('server:stop', serverInfo)
}

const config = async (serverInfo: ServerInfo) => {
    return ipcRenderer.invoke('server:config', serverInfo)
}

const callFunction = async (serverInfo: ServerInfo, method: string, data: any) => {
    return ipcRenderer.invoke('server:callFunction', serverInfo, method, data)
}

export default {
    start,
    ping,
    stop,
    config,
    callFunction,
}
