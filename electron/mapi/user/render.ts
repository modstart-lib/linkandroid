import {ipcRenderer} from 'electron'

const open = async (option: any) => {
    return ipcRenderer.invoke('user:open', option)
}

const get = async (): Promise<any> => {
    return ipcRenderer.invoke('user:get')
}

const save = async (data: {apiToken: string; user: any; data: any; basic: any}): Promise<void> => {
    return ipcRenderer.invoke('user:save', data)
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

const apiPost = async (
    url: string,
    data: Record<string, any>,
    option?: {
        throwException?: boolean
    },
) => {
    return ipcRenderer.invoke('user:apiPost', url, data, option)
}

export default {
    open,
    get,
    save,
    refresh,
    getApiToken,
    getWebEnterUrl,
    openWebUrl,
    apiPost,
}
