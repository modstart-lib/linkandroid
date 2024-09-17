import path from "node:path";
import {AppEnv, waitAppEnvReady} from "../env";
import fs from "node:fs";

let data = {}

const configRoot = () => {
    return path.join(AppEnv.userData, 'storage')
}

const configPath = (group: string) => {
    return path.join(configRoot(), `${group}.json`)
}

const load = (group: string) => {
    try {
        const p = configPath(group)
        let json = fs.readFileSync(p).toString()
        json = JSON.parse(json)
        data[group] = json || {}
    } catch (e) {
        data[group] = {}
    }
}

const loadIfNeed = (group: string) => {
    if (!(group in data)) {
        load(group)
    }
}

const save = (group: string) => {
    const path = configPath(group)
    if (!fs.existsSync(configRoot())) {
        fs.mkdirSync(configRoot(), {recursive: true})
    }
    fs.writeFileSync(path, JSON.stringify(data[group], null, 4))
}

const all = async (group: string) => {
    await waitAppEnvReady()
    loadIfNeed(group)
    return data[group]
}

const get = async (group: string, key: string, defaultValue: any) => {
    await waitAppEnvReady()
    loadIfNeed(group)
    if (!(key in data[group])) {
        data[group][key] = defaultValue
        save(group)
    }
    return data[group][key]
}

const set = async (group: string, key: string, value: any) => {
    await waitAppEnvReady()
    loadIfNeed(group)
    data[group][key] = value
    save(group)
}

export default {
    all,
    get,
    set
}
