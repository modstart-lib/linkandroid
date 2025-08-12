import {BrowserWindow} from "electron";
import {preloadDefault} from "../lib/env-main";
import {t} from "../config/lang";
import {Page} from "./index";
import {WindowConfig} from "../config/window";
import {AppRuntime} from "../mapi/env";

export const PageLog = {
    NAME: "log",
    open: async (option: {
        log: string,
    }) => {
        if (AppRuntime.windows[PageLog.NAME]) {
            AppRuntime.windows[PageLog.NAME].close();
        }
        const win = new BrowserWindow({
            title: t("日志"),
            parent: null,
            minWidth: WindowConfig.logWidth,
            minHeight: WindowConfig.logHeight,
            width: WindowConfig.logWidth,
            height: WindowConfig.logHeight,
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
        await Page.openWindow(PageLog.NAME, win, "page/log.html");
        const logInit = {
            log: option.log,
        }
        win.webContents.executeJavaScript(`
        const logInit = ()=>{
            if(!window.__logInit){
                setTimeout(logInit, 100);
                return;
            }
            window.__logInit(${JSON.stringify(logInit)});
        };logInit();
        `);
    },
};
