import {dialog, ipcMain, shell} from "electron";
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

export default {
    ...fileIndex,
};

export const Files = {
    ...fileIndex,
};
