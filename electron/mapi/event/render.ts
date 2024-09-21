import {ipcRenderer} from "electron";

const init = () => {

}

const send = (name: string, type: string, data: any = {}) => {
    ipcRenderer.invoke('event:send', name, type, data).then()
}

const callCustom = async (name: string, customType: string, data: any, option: any) => {
    return ipcRenderer.invoke('event:callCustom', name, customType, data, option)
}

export default {
    init,
    send,
    callCustom
}
