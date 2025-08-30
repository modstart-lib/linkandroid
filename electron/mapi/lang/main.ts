import {Files} from "../file/main";
import {AppEnv, AppRuntime} from "../env";
import {JsonUtil, StrUtil} from "../../lib/util";
import {langMessageList} from "../../config/lang";
import {app, dialog, ipcMain} from "electron";
import {Log} from "../log/main";
import {isDev} from "../../lib/env";
import {AppsMain} from "../app/main";

const fileSyncer = {
    readJson: async function (file: string) {
        let filePath = Files.absolutePath([AppEnv.appRoot, file].join("/"));
        const sourceContent = (await Files.read(filePath)) || "{}";
        return JSON.parse(sourceContent);
    },
    writeJson: async function (file: string, data: any, order: "key" | "value" = "key") {
        let filePath = Files.absolutePath([AppEnv.appRoot, file].join("/"));
        let jsonString: any;
        if (order === "key") {
            jsonString = JsonUtil.stringifyOrdered(data);
        } else {
            jsonString = JsonUtil.stringifyValueOrdered(data);
        }
        await Files.write(filePath, jsonString);
    },
};


const mergeJson = {};
let mergeJsonIgnore = false;
let autoWriteTimer = null;

const readSource = async () => {
    const json = await fileSyncer.readJson("src/lang/source.json");
    if (!mergeJson['source']) {
        mergeJson['source'] = {};
    }
    for (const k in mergeJson['source']) {
        if (!json[k]) {
            json[k] = mergeJson['source'][k];
        }
    }
    return json;
}

const readLang = async (name: string) => {
    const jsonLang = await fileSyncer.readJson(`src/lang/${name}.json`);
    if (!mergeJson[name]) {
        mergeJson[name] = {};
    }
    for (const k in mergeJson[name]) {
        if (!jsonLang[k]) {
            jsonLang[k] = mergeJson[name][k];
        }
    }
    return jsonLang;
}

const writeSourceKey = async (key: string) => {
    const source = await readSource();
    if (source[key]) {
        return;
    }
    source[key] = StrUtil.hashCodeWithDuplicateCheck(key, Object.values(source));
    mergeJson['source'][key] = source[key];
    for (let l of langMessageList) {
        const langJson = await readLang(l.name);
        langJson[source[key]] = key;
        mergeJson[l.name][source[key]] = key;
    }
    Log.info("Lang.writeSourceKey", {key, id: source[key]});
    AppsMain.toast(`Lang Missing: ${key}`, {status: "info"}).then();
    if (!mergeJsonIgnore) {
        autoWrite();
    }
};

const autoWrite = (delay = 10000) => {
    if (autoWriteTimer) {
        clearTimeout(autoWriteTimer);
        autoWriteTimer = null;
    }
    autoWriteTimer = setTimeout(() => {
        autoWriteTimer = null;
        const count = Object.keys(mergeJson['source'] || {}).length;
        const keys = Object.keys(mergeJson['source'] || {}).join("\n");
        dialog.showMessageBox(AppRuntime.mainWindow, {
            type: "info",
            title: "Info",
            message: `Write ${count} lang key(s) now ? This will cause app restart\n\n${keys}`,
            buttons: ["OK", "Not Write", "Delay 10s", "Delay 60s"],
            defaultId: 0,
            cancelId: 1,
        }).then(async (result) => {
            if (result.response === 0) {
                for (const k in mergeJson) {
                    if (k === 'source') {
                        const source = await readSource();
                        await fileSyncer.writeJson("src/lang/source.json", source);
                    } else {
                        const langJson = await readLang(k);
                        await fileSyncer.writeJson(`src/lang/${k}.json`, langJson);
                    }
                }
                for (const k in mergeJson) {
                    mergeJson[k] = {};
                }
            } else if (result.response === 1) {
                Log.info("Lang.autoWrite", "User canceled write lang keys");
                for (const k in mergeJson) {
                    mergeJson[k] = {};
                }
                mergeJsonIgnore = true;
            } else if (result.response === 2) {
                Log.info("Lang.autoWrite", "User delay write lang keys 10s");
                autoWrite(10000);
            } else if (result.response === 3) {
                Log.info("Lang.autoWrite", "User delay write lang keys 60s");
                autoWrite(60000);
            }
        });
    }, delay);
}
if (isDev) {
    app.on("before-quit", (e) => {
        if (!mergeJsonIgnore) {
            for (const k in mergeJson) {
                if (mergeJson[k] && Object.keys(mergeJson[k]).length > 0) {
                    e.preventDefault();
                    autoWrite(0);
                }
            }
        }
    });
}

const writeSourceKeyUse = async (key: string) => {
    const json = await fileSyncer.readJson("src/lang/source-use.json");
    if (!json[key]) {
        json[key] = 1;
    } else {
        json[key]++;
    }
    await fileSyncer.writeJson("src/lang/source-use.json", json, "value");
};

ipcMain.handle("lang:writeSourceKey", async (_, key) => {
    await writeSourceKey(key);
});
ipcMain.handle("lang:writeSourceKeyUse", async (_, key) => {
    await writeSourceKeyUse(key);
});

export default {
    writeSourceKey,
    writeSourceKeyUse,
};
