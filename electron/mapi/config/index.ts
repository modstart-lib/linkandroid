import path from "node:path";
import {AppEnv, waitAppEnvReady} from "../env";
import fs from "node:fs";

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
    await waitAppEnvReady()
    loadIfNeed()
    return data
}

const get = async (key: string, defaultValue: any = null) => {
    await waitAppEnvReady()
    loadIfNeed()
    if (!(key in data)) {
        data[key] = defaultValue
        save()
    }
    return data[key]
}

const set = async (key: string, value: any) => {
    await waitAppEnvReady()
    loadIfNeed()
    data[key] = value
    save()
}

export default {
    all,
    get,
    set,
    Config: {
        all,
        get,
        set
    }
}
