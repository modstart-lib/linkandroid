import storage from "../storage";
import {ipcMain, shell} from "electron";
import {AppConfig} from "../../../src/config";
import {ResultType} from "../../lib/api";
import {Events} from "../event/main";

const init = () => {
    return null
}

const userData = {
    isInit: false,
    apiToken: '',
    user: {
        id: '',
        name: '',
        avatar: '',
    },
    data: {
        basic: {},
    },
}

const get = async (): Promise<{
    apiToken: string,
    user: object,
    data: any,
}> => {
    if (!userData.isInit) {
        const userStorageData = await storage.get('user', 'data', {})
        userData.apiToken = userStorageData.apiToken || ''
        userData.user = userStorageData.user || {}
        userData.data = userStorageData.data || {}
        userData.isInit = true
    }
    userData.user.id = userData.user.id || ''
    userData.data.basic = userData.data.basic || {}
    return {
        apiToken: userData.apiToken,
        user: userData.user,
        data: userData.data,
    }
}

ipcMain.handle('user:get', async (event) => {
    return get()
})

const save = async (data: {
    apiToken: string,
    user: any,
    data: any
}) => {
    userData.apiToken = data.apiToken
    userData.user = data.user
    userData.data = data.data
    userData.user.id = userData.user.id || ''
    userData.data.basic = userData.data.basic || {}
    Events.broadcast('UserChange', {})
    await storage.set('user', 'data', {
        apiToken: data.apiToken,
        user: data.user,
        data: data.data
    })
}

ipcMain.handle('user:save', async (event, data) => {
    return save(data)
})

const refresh = async () => {
    const result = await userInfoApi()
    await save({
        apiToken: result.data.apiToken,
        user: result.data.user,
        data: result.data.data
    })
}

ipcMain.handle('user:refresh', async (event) => {
    return refresh()
})

const getApiToken = async (): Promise<string> => {
    await get()
    return userData.apiToken
}

ipcMain.handle('user:getApiToken', async (event) => {
    return getApiToken()
})

const getWebEnterUrl = async (url: string) => {
    const apiToken = await getApiToken()
    return `${AppConfig.apiBaseUrl}/app_manager/enter?url=${encodeURIComponent(url)}&api_token=${apiToken}`
}

ipcMain.handle('user:getWebEnterUrl', async (event, url) => {
    return getWebEnterUrl(url)
})

const openWebUrl = async (url: string) => {
    url = await getWebEnterUrl(url)
    await shell.openExternal(url)
}

ipcMain.handle('user:openWebUrl', async (event, url) => {
    return openWebUrl(url)
})

export const User = {
    init,
    get,
    save,
    getApiToken,
    getWebEnterUrl,
    openWebUrl,
}

export default User

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
    const json = await res.json()
    if (json.code) {
        // 未登录或登录过期
        if (json.code === 1001) {
            await refresh()
        }
    }
    return json
}

const userInfoApi = async (): Promise<ResultType<{
    apiToken: string,
    user: object,
    data: any,
    basic: object,
}>> => {
    return await post('app_manager/user_info', {})
}

export const UserApi = {
    post,
    userInfoApi
}
