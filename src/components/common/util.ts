import {Dialog} from "../../lib/dialog";
import {t} from "../../lang";

export const doCopy = async (text: string, successTip: string = ''): Promise<void> => {
    successTip = successTip || t('复制成功');
    await window.$mapi.app.setClipboardText(text);
    Dialog.tipSuccess(successTip);
}
