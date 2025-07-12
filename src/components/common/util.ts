import {Dialog} from "../../lib/dialog";
import {t} from "../../lang";
import {defaultResponseProcessor} from "../../lib/api";
import {VersionUtil} from "../../lib/util";
import {AppConfig} from "../../config";

export const doCopy = async (text: string, successTip: string = ''): Promise<void> => {
    successTip = successTip || t('复制成功');
    await window.$mapi.app.setClipboardText(text);
    Dialog.tipSuccess(successTip);
}

export const doCheckForUpdate = async () => {
    const res = await window.$mapi.updater.checkForUpdate()
    defaultResponseProcessor(res, (res: ApiResult<any>) => {
        if (!res.data.version) {
            Dialog.tipError(t('检测更新失败'))
            return
        }
        if (VersionUtil.le(res.data.version, AppConfig.version)) {
            Dialog.tipSuccess(t('已经是最新版本'))
            return
        }
        Dialog.confirm(t('发现新版本{version}，是否立即下载更新？', {version: res.data.version}))
            .then(() => {
                window.$mapi.app.openExternalWeb(AppConfig.downloadUrl)
            })
    })
}
