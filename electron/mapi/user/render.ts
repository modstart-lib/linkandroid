import page from "../page/render";
import {ipcRenderer} from "electron";

const open = async (option: any) => {
    await page.open('user', option)
}

const get = async (): Promise<{
    apiToken: string,
    user: object,
    data: any,
}> => {
    return ipcRenderer.invoke('user:get')
}

const save = async (data: {
    apiToken: string,
    user: object,
    data: any
}) => {
    return ipcRenderer.invoke('user:save', data)
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

export default {
    open,
    save,
    get,
    getApiToken,
    getWebEnterUrl,
    openWebUrl
}
