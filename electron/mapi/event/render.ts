import {ipcRenderer} from "electron";

const init = () => {

}

const send = (name: string, type: string, data: any = {}) => {
    return ipcRenderer.invoke('event:send', name, type, data).then()
}

const callPage = async (name: string, type: string, data: any, option: any) => {
    return ipcRenderer.invoke('event:callPage', name, type, data, option)
}

const channelSend = async (channel: string, data: any) => {
    return ipcRenderer.invoke('event:channelSend', channel, data)
}

export default {
    init,
    send,
    callPage,
    channelSend,
}
