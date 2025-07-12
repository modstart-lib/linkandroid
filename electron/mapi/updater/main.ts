import updaterIndex from './index'
import {Log} from "../log/main";
import {AppConfig} from "../../../src/config";
import {VersionUtil} from "../../lib/util";
import {dialog, ipcMain, shell} from "electron";
import {t} from "../../config/lang";
import ConfigMain from "../config/main";


ipcMain.handle('updater:getCheckAtLaunch', async (event) => {
    return ConfigMain.get('updaterCheckAtLaunch', 'yes')
})

ipcMain.handle('updater:setCheckAtLaunch', async (event, value) => {
    return ConfigMain.set('updaterCheckAtLaunch', value)
})

export const UpdaterMain = {
    ...updaterIndex,
}
