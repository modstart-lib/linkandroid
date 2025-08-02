import {ipcMain} from "electron";
import logIndex from "./index";

ipcMain.handle("log:info", (event, label: string, data: any) => {
    logIndex.info(label, data);
});
ipcMain.handle("log:error", (event, label: string, data: any) => {
    logIndex.error(label, data);
});

export default {
    info: logIndex.info,
    error: logIndex.error,
};

export const Log = {
    info: logIndex.info,
    error: logIndex.error,
};
