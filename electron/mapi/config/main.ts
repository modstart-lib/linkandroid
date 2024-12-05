import path from "node:path";
import {AppEnv} from "../env";
import fs from "node:fs";
import {dialog, ipcMain} from "electron";
import {Events} from "../event/main";

let data = null

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

export default {
    all,
    get,
    set,
}

export const ConfigMain = {
    all,
    get,
    set
}
