import fileIndex from './index'
import {ipcRenderer, webUtils} from 'electron'

const openFile = async (options: {} = {}) => {
    return ipcRenderer.invoke('file:openFile', options)
}

const openDirectory = async (options: {} = {}) => {
    return ipcRenderer.invoke('file:openDirectory', options)
}

const openSave = async (options: {} = {}) => {
    return ipcRenderer.invoke('file:openSave', options)
}

// File.path was removed in Electron 32, webUtils only works in the renderer process
const pathForFile = (file: File) => {
    return webUtils.getPathForFile(file)
}

export default {
    ...fileIndex,
    openFile,
    openDirectory,
    openSave,
    pathForFile,
}
