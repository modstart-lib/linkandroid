import {ipcRenderer} from "electron";

const init = () => {

}

const send = (name: string, type: string, data: any = {}) => {
    return ipcRenderer.invoke('event:send', name, type, data).then()
}

const callThirdParty = async (name: string, type: string, data: any, option: any) => {
    return ipcRenderer.invoke('event:callThirdParty', name, type, data, option)
}

const callPage = async (name: string, type: string, data: any, option: any) => {
    return ipcRenderer.invoke('event:callPage', name, type, data, option)
}


const channelCreate = async (callback: (data: any) => void) => {
    const channel = Math.random().toString(36).substring(2)
    window['__channel'] = window['__channel'] || {}
    window['__channel'][channel] = callback
    return channel
}

const channelDestroy = async (channel: string) => {
    delete window['__channel'][channel]
}

const channelSend = async (channel: string, data: any) => {
    return ipcRenderer.invoke('event:channelSend', channel, data)
}

export default {
    init,
    send,
    callThirdParty,
    callPage,
    channelCreate,
    channelDestroy,
    channelSend,
}
