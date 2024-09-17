import fileIndex from './index'
import {ipcRenderer} from "electron";

const openFile = async (options: {} = {}) => {
    return ipcRenderer.invoke('file:openFile', options)
}

export default {
    ...fileIndex,
    openFile
}

