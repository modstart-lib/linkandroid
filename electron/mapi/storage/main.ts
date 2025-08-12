import {AppEnv, waitAppEnvReady} from "../env";
import fs from "node:fs";
import {ipcMain} from "electron";
import nodePath from "node:path";

let data = {};

const userDataRoot = () => {
    return nodePath.join(AppEnv.userData, "storage");
};

const dataRoot = () => {
    return nodePath.join(AppEnv.dataRoot, "storage");
}

const filePath = (group: string) => {
    let p = nodePath.join(userDataRoot(), `${group}.json`);
    if (fs.existsSync(p)) {
        return p;
    }
    return nodePath.join(dataRoot(), `${group}.json`);
};

const load = (group: string) => {
    try {
        const p = filePath(group);
        let json = fs.readFileSync(p).toString();
        json = JSON.parse(json);
        data[group] = json || {};
    } catch (e) {
        data[group] = {};
    }
};

const loadIfNeed = (group: string) => {
    if (!(group in data)) {
        load(group);
    }
};

const save = (group: string) => {
    const path = filePath(group);
    const dir = nodePath.dirname(path);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, {recursive: true});
    }
    fs.writeFileSync(path, JSON.stringify(data[group], null, 4));
};

const all = async (group: string) => {
    await waitAppEnvReady();
    loadIfNeed(group);
    return data[group];
};

const get = async (group: string, key: string, defaultValue: any) => {
    await waitAppEnvReady();
    loadIfNeed(group);
    if (!(key in data[group])) {
        data[group][key] = defaultValue;
        save(group);
    }
    return data[group][key];
};

const set = async (group: string, key: string, value: any) => {
    await waitAppEnvReady();
    loadIfNeed(group);
    data[group][key] = value;
    save(group);
};

const read = async (group: string, defaultValue: any) => {
    await waitAppEnvReady();
    loadIfNeed(group);
    if (!(group in data)) {
        data[group] = defaultValue;
        save(group);
    }
    return data[group];
};

const write = async (group: string, value: any) => {
    await waitAppEnvReady();
    loadIfNeed(group);
    data[group] = value;
    save(group);
};

ipcMain.handle("storage:all", async (event, group: string) => {
    return await all(group);
});

ipcMain.handle("storage:get", async (event, group: string, key: string, defaultValue: any) => {
    return await get(group, key, defaultValue);
});

ipcMain.handle("storage:set", async (event, group: string, key: string, value: any) => {
    return await set(group, key, value);
});

ipcMain.handle("storage:read", async (event, group: string, defaultValue: any) => {
    return await read(group, defaultValue);
});

ipcMain.handle("storage:write", async (event, group: string, value: any) => {
    return await write(group, value);
});

export const StorageMain = {
    all,
    get,
    set,
    read,
    write,
};

export default StorageMain;
