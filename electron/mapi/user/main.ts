import storage from "../storage";
import {ipcMain} from "electron";
import {AppConfig} from "../../../src/config";
import {ResultType} from "../../lib/api";

const init = () => {
    return null
}

const get = async (): Promise<{
    apiToken: string,
    user: object,
    data: any,
}> => {
    const apiToken = await storage.get('user', 'apiToken', '')
    const user = await storage.get('user', 'user', {})
    const data = await storage.get('user', 'data', {})
    return {apiToken, user, data}
}

const getApiToken = async (): Promise<string> => {
    return await storage.get('user', 'apiToken', '')
}

const save = async (data: {
    apiToken: string,
    user: object,
    data: any
}) => {
    await storage.set('user', 'apiToken', data.apiToken)
    await storage.set('user', 'user', data.user)
    await storage.set('user', 'data', data.data)
}

ipcMain.handle('user:get', async (event) => {
    return get()
})

ipcMain.handle('user:save', async (event, data) => {
    return save(data)
})

export default {
    init,
    get,
    save
}


export const User = {
    getApiToken
}


const post = async <T>(api: string, data: Record<string, any>): Promise<ResultType<T>> => {
    const url = `${AppConfig.apiBaseUrl}/${api}`
    const apiToken = await User.getApiToken()
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Api-Token': apiToken
        },
        body: JSON.stringify(data)
    })
    return await res.json()
}

export const UserApi = {
    post
}
