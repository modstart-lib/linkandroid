import {preloadDefault, rendererPath} from "../util/path-main";
import {AppRuntime} from "../mapi/env";
import {BrowserWindow} from "electron";
import {Page} from "./index";
import {t} from "../config/lang";

export const PageThirdPartyImageBeautifier = {
    NAME: 'thirdPartyImageBeautifier',
    open: (option: any) => {
        const win = new BrowserWindow({
            title: t('截图编辑'),
            parent: AppRuntime.mainWindow,
            minWidth: 800,
            minHeight: 600,
            hasShadow: true,
            center: true,
            autoHideMenuBar: true,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false,
                webSecurity: false,
                preload: preloadDefault
            },
            show: true,
            frame: true,
        });
        return Page.openWindow(PageThirdPartyImageBeautifier.NAME, win, "third-party/image-beautifier/index.html");
    }
}
