import page from "../page/render";
import {ipcRenderer} from "electron";

const open = async (option: any) => {
    await page.open('user', option)
}

const get = async (): Promise<any> => {
    return ipcRenderer.invoke('user:get')
}

const refresh = async () => {
    return ipcRenderer.invoke('user:refresh')
}

const getApiToken = async (): Promise<string> => {
    return ipcRenderer.invoke('user:getApiToken')
}

const getWebEnterUrl = async (url: string) => {
    return ipcRenderer.invoke('user:getWebEnterUrl', url)
}

const openWebUrl = async (url: string) => {
    return ipcRenderer.invoke('user:openWebUrl', url)
}

const apiPost = async (url: string, data: any) => {
    return ipcRenderer.invoke('user:apiPost', url, data)
}

export default {
    open,
    get,
    refresh,
    getApiToken,
    getWebEnterUrl,
    openWebUrl,
    apiPost,
}
