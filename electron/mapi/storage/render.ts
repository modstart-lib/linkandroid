import {ipcRenderer} from "electron";


const all = async (group: string) => {
    return ipcRenderer.invoke('storage:all', group)
}

const get = async (group: string, key: string, defaultValue: any) => {
    return ipcRenderer.invoke('storage:get', group, key, defaultValue)
}

const set = async (group: string, key: string, value: any) => {
    return ipcRenderer.invoke('storage:set', group, key, value)
}

const read = async (group: string, defaultValue: any = null) => {
    return ipcRenderer.invoke('storage:read', group, defaultValue)
}

const write = async (group: string, value: any) => {
    return ipcRenderer.invoke('storage:write', group, value)
}

export default {
    all,
    get,
    set,
    read,
    write,
}
