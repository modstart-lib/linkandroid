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

const checkAndNotice = async () => {

    const checkAtLaunch = await ConfigMain.get('updaterCheckAtLaunch', 'yes')
    if ('yes' !== checkAtLaunch) {
        return
    }
    const res = await updaterIndex.checkForUpdate()
    if (res.code) {
        Log.info('Updater.checkAndNotice.fail', res.msg)
        return
    }
    // res.data.version = '1.0.0'
    if (VersionUtil.le(res.data.version, AppConfig.version)) {
        return
    }
    const ignoreVersion = await ConfigMain.get('updaterIgnoreVersion', '')
    if (ignoreVersion === res.data.version) {
        return
    }
    const options = {
        type: 'info',
        title: t('新版本可用'),
        message: t('发现新版本 {version}，是否立即升级？', {
            version: res.data.version
        }),
        buttons: [t('下载'), t('忽略')],
        defaultId: 0,
        cancelId: 1,
    };
    dialog.showMessageBox(null, options as any)
        .then(result => {
            if (result.response === 0) {
                shell.openExternal(AppConfig.downloadUrl).then()
            } else {
                ConfigMain.set('updaterIgnoreVersion', res.data.version).then()
            }
        })
}

const checkAndNoticeIfNeed = async () => {
    await checkAndNotice()
}

export const UpdaterMain = {
    checkForUpdate: updaterIndex.checkForUpdate,
    checkAndNotice,
    checkAndNoticeIfNeed,
}
