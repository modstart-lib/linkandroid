import {ipcRenderer} from "electron";

let data = null


const all = async () => {
    return ipcRenderer.invoke('config:all')
}

const get = async (key: string, defaultValue: any = null) => {
    return ipcRenderer.invoke('config:get', key, defaultValue)
}

const set = async (key: string, value: any) => {
    return ipcRenderer.invoke('config:set', key, value)
}

export default {
    all,
    get,
    set,
}
