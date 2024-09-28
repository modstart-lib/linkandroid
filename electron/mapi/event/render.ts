import {ipcRenderer} from "electron";

const init = () => {

}

const send = (name: string, type: string, data: any = {}) => {
    ipcRenderer.invoke('event:send', name, type, data).then()
}

const callThirdParty = async (name: string, type: string, data: any, option: any) => {
    return ipcRenderer.invoke('event:callThirdParty', name, type, data, option)
}

const callPage = async (name: string, type: string, data: any, option: any) => {
    return ipcRenderer.invoke('event:callPage', name, type, data, option)
}

export default {
    init,
    send,
    callThirdParty,
    callPage
}
