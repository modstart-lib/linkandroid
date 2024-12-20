import path from "node:path";
import {AppEnv} from "../env";
import fs from "node:fs";
import {dialog, ipcMain} from "electron";
import {Events} from "../event/main";

let data = null
let dataEnv = {}

const configPath = () => {
    return path.join(AppEnv.userData, 'config.json')
}

const load = () => {
    try {
        let json = fs.readFileSync(configPath()).toString()
        json = JSON.parse(json)
        data = json || {}
    } catch (e) {
        data = {}
    }
}

const loadIfNeed = () => {
    if (data === null) {
        load()
    }
}

const save = () => {
    fs.writeFileSync(configPath(), JSON.stringify(data, null, 4))
}

const all = async () => {
    loadIfNeed()
    return data
}

const get = async (key: string, defaultValue: any = null) => {
    loadIfNeed()
    if (!(key in data)) {
        data[key] = defaultValue
        save()
    }
    return data[key]
}

const set = async (key: string, value: any) => {
    loadIfNeed()
    data[key] = value
    save()
}

const allEnv = async () => {
    return dataEnv
}

const getEnv = async (key: string, defaultValue: any = null) => {
    if (!(key in dataEnv)) {
        dataEnv[key] = defaultValue
    }
    return dataEnv[key]
}

const setEnv = async (key: string, value: any) => {
    dataEnv[key] = value
}

ipcMain.handle('config:all', async (_) => {
    return await all()
})
ipcMain.handle('config:get', async (_, key: string, defaultValue: any = null) => {
    return await get(key, defaultValue)
})
ipcMain.handle('config:set', async (_, key: string, value: any) => {
    const res = await set(key, value)
    Events.broadcast('ConfigChange', {key, value})
    return res
})

ipcMain.handle('config:allEnv', async (_) => {
    return await allEnv()
})

ipcMain.handle('config:getEnv', async (_, key: string, defaultValue: any = null) => {
    return await getEnv(key, defaultValue)
})

ipcMain.handle('config:setEnv', async (_, key: string, value: any) => {
    const res = await setEnv(key, value)
    Events.broadcast('ConfigEnvChange', {key, value})
    return res
})

export const ConfigMain = {
    all,
    get,
    set,
    allEnv,
    getEnv,
    setEnv,
}

export default ConfigMain
