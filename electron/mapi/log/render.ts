import {ipcRenderer} from "electron";

const info = (label: string, data: any = null) => {
    return ipcRenderer.invoke('log:info', label, data)
}
const error = (label: string, data: any = null) => {
    return ipcRenderer.invoke('log:error', label, data)
}

export default {
    info,
    error,
}
