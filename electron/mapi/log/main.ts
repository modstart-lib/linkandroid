import {ipcMain} from "electron";
import logIndex from "./index";

ipcMain.handle("log:info", (event, label: string, data: any) => {
    logIndex.info(label, data);
});
ipcMain.handle("log:error", (event, label: string, data: any) => {
    logIndex.error(label, data);
});
ipcMain.handle("log:appInfo", (event, name: string, label: string, data: any) => {
    logIndex.appInfo(name, label, data);
})
ipcMain.handle("log:appError", (event, name: string, label: string, data: any) => {
    logIndex.appError(name, label, data);
});

export default {
    info: logIndex.info,
    error: logIndex.error,
    appInfo: logIndex.appInfo,
    appError: logIndex.appError,
};

export const Log = {
    info: logIndex.info,
    error: logIndex.error,
    appPath: logIndex.appPath,
    appInfo: logIndex.appInfo,
    appError: logIndex.appError,
};
