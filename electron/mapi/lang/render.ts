import {ipcRenderer} from "electron";


const writeSourceKey = async (key: string) => {
    return ipcRenderer.invoke('lang:writeSourceKey', key)
}

const writeSourceKeyUse = async (key: string) => {
    return ipcRenderer.invoke('lang:writeSourceKeyUse', key)
}


export default {
    writeSourceKey,
    writeSourceKeyUse
}
