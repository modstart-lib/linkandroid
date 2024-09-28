import storage from "../storage";
import {ipcMain} from "electron";

const init = () => {
    return null
}

const get = async (): Promise<{
    apiToken: string,
    user: object,
    data: any
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
