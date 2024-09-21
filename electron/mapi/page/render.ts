import {ipcRenderer} from "electron";


const open = async (name: string, option: any) => {
    return ipcRenderer.invoke('page:open', name, option)
}

export default {
    open
}
