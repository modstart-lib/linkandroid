import {onMounted, watch} from "vue";
import {AppConfig} from "../../config";
import {t} from "../../lang";
import {defaultResponseProcessor} from "../../lib/api";
import {Dialog} from "../../lib/dialog";
import {StorageUtil} from "../../lib/storage";
import {VersionUtil} from "../../lib/util";

export const doCopy = async (text: string | object, successTip: string = ""): Promise<void> => {
    successTip = successTip || t("复制成功");
    text = typeof text === "object" ? JSON.stringify(text) : String(text);
    await window.$mapi.app.setClipboardText(text);
    Dialog.tipSuccess(successTip);
};

export const doSaveFile = async (filePath: string) => {
    try {
        const options: any = {
            defaultPath: window.$mapi.file.pathToName(filePath, true, -1),
        };
        const savePath = await window.$mapi.file.openSave(options);
        if (savePath) {
            await window.$mapi.file.copy(filePath, savePath, {
                isFullPath: true
            });
            Dialog.tipSuccess(t("文件已保存到 {path}", {path: savePath}));
        }
    } catch (error) {
        Dialog.tipError(t("保存文件失败: {error}", {error: (error as Error).message || error}));
    }
};

export const doCheckForUpdate = async (noticeLatest?: boolean) => {
    const res = await window.$mapi.updater.checkForUpdate();
    defaultResponseProcessor(res, (res: ApiResult<any>) => {
        if (!res.data.version) {
            Dialog.tipError(t("检测更新失败"));
            return;
        }
        if (VersionUtil.le(res.data.version, AppConfig.version)) {
            if (noticeLatest) {
                Dialog.tipSuccess(t("已经是最新版本"));
            }
            return;
        }
        Dialog.confirm(t("发现新版本{version}，是否立即下载更新？", {version: res.data.version})).then(() => {
            window.$mapi.app.openExternal(AppConfig.downloadUrl);
        });
    });
};

export const dataAutoSaveDraft = (key: string, data: any) => {
    onMounted(async () => {
        const old = StorageUtil.getObject(key);
        for (const prop in old) {
            if (Object.prototype.hasOwnProperty.call(old, prop)) {
                data[prop] = old[prop];
            }
        }
    });
    watch(
        () => data,
        async value => {
            StorageUtil.set(key, value);
        },
        {
            deep: true,
        }
    );
    const clearDraft = () => {
        StorageUtil.remove(key);
    };
    return {clearDraft};
};
