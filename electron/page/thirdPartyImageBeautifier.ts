import {preloadDefault} from "../lib/env-main";
import {AppRuntime} from "../mapi/env";
import {BrowserWindow} from "electron";
import {Page} from "./index";
import {t} from "../config/lang";

export const PageThirdPartyImageBeautifier = {
    NAME: "thirdPartyImageBeautifier",
    open: (option: any) => {
        const win = new BrowserWindow({
            title: t("截图编辑"),
            parent: null,
            minWidth: 900,
            minHeight: 700,
            width: 900,
            height: 700,
            maximizable: true,
            hasShadow: true,
            center: true,
            autoHideMenuBar: true,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false,
                webSecurity: false,
                preload: preloadDefault,
            },
            show: true,
            frame: true,
        });
        // win.maximize();
        return Page.openWindow(PageThirdPartyImageBeautifier.NAME, win, "third-party/image-beautifier/index.html");
    },
};
