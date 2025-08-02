import updaterIndex from "./index";
import {ipcMain} from "electron";
import ConfigMain from "../config/main";

ipcMain.handle("updater:getCheckAtLaunch", async event => {
    return ConfigMain.get("updaterCheckAtLaunch", "yes");
});

ipcMain.handle("updater:setCheckAtLaunch", async (event, value) => {
    return ConfigMain.set("updaterCheckAtLaunch", value);
});

export const UpdaterMain = {
    ...updaterIndex,
};

export default UpdaterMain;
