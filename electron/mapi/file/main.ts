import {dialog, ipcMain} from "electron";
import fileIndex from "./index";

ipcMain.handle("file:openFile", async (
    event,
    options: {
        filters?: {
            name: string;
            extensions: string[];
        }[],
        properties?: ("multiSelections" | "openFile")[]
    } = {}): Promise<string | string[] | null> => {
    options = Object.assign({
        filters: [],
        properties: [],
    }, options);
    if (!options.properties.includes("openFile")) {
        options.properties.push("openFile");
    }
    // @ts-ignore
    options.properties.push('noResolveAliases');
    const res = await dialog
        .showOpenDialog({
            ...options,
        })
        .catch(e => {
        });
    if (!res || res.canceled) {
        return null;
    }
    if (options.properties.includes("multiSelections")) {
        return res.filePaths || null;
    }
    return res.filePaths?.[0] || null;
});

ipcMain.handle("file:openDirectory", async (_, options): Promise<string | null> => {
    const res = await dialog
        .showOpenDialog({
            properties: ["openDirectory"],
            ...options,
        })
        .catch(e => {
        });
    if (!res || res.canceled) {
        return null;
    }
    return res.filePaths?.[0] || null;
});

ipcMain.handle("file:openSave", async (_, options): Promise<string | null> => {
    const res = await dialog
        .showSaveDialog({
            ...options,
        })
        .catch(e => {
        });
    if (!res || res.canceled) {
        return null;
    }
    return res.filePath || null;
});

const autoCleanTemp = async () => {
    fileIndex.autoCleanTemp(1).finally(() => {
        setTimeout(() => {
            autoCleanTemp();
        }, 10 * 60 * 1000);
    });
}

setTimeout(() => {
    autoCleanTemp().then();
}, 5000);


export default {
    ...fileIndex,
};

export const Files = {
    ...fileIndex,
};
