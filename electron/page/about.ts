import {BrowserWindow} from "electron";
import {preloadDefault} from "../lib/env-main";
import {AppRuntime} from "../mapi/env";
import {t} from "../config/lang";
import {Page} from "./index";
import {WindowConfig} from "../config/window";

export const PageAbout = {
    NAME: "about",
    open: async (option: any) => {
        const win = new BrowserWindow({
            title: t("关于"),
            parent: AppRuntime.mainWindow,
            minWidth: WindowConfig.aboutWidth,
            minHeight: WindowConfig.aboutHeight,
            width: WindowConfig.aboutWidth,
            height: WindowConfig.aboutHeight,
            webPreferences: {
                preload: preloadDefault,
                // Warning: Enable nodeIntegration and disable contextIsolation is not secure in production
                nodeIntegration: true,
                webSecurity: false,
                webviewTag: true,
                // Consider using contextBridge.exposeInMainWorld
                // Read more on https://www.electronjs.org/docs/latest/tutorial/context-isolation
                contextIsolation: false,
            },
            show: true,
            frame: false,
            transparent: false,
        });
        return Page.openWindow(PageAbout.NAME, win, "page/about.html");
    },
};
