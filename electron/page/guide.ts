import {BrowserWindow} from "electron";
import {preloadDefault, rendererLoadPath} from "../lib/env-main";
import {Page} from "./index";
import {AppConfig} from "../../src/config";
import {icnsLogoPath, icoLogoPath, logoPath} from "../config/icon";
import {isPackaged} from "../lib/env";
import {WindowConfig} from "../config/window";
import * as remoteMain from "@electron/remote/main";
import {DevToolsManager} from "../lib/devtools";

export const PageGuide = {
    NAME: "guide",
    open: async (option: any) => {
        let icon = logoPath;
        if (process.platform === "win32") {
            icon = icoLogoPath;
        } else if (process.platform === "darwin") {
            icon = icnsLogoPath;
        }
        const win = new BrowserWindow({
            show: true,
            title: AppConfig.name,
            ...(!isPackaged ? {icon} : {}),
            frame: false,
            transparent: false,
            hasShadow: true,
            center: true,
            useContentSize: true,
            minWidth: WindowConfig.guideWidth,
            minHeight: WindowConfig.guideHeight,
            width: WindowConfig.guideWidth,
            height: WindowConfig.guideHeight,
            skipTaskbar: true,
            resizable: false,
            maximizable: false,
            backgroundColor: "#f1f5f9",
            alwaysOnTop: false,
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
        });

        win.on("closed", () => {
            Page.unregisterWindow(PageGuide.NAME);
        });

        rendererLoadPath(win, "page/guide.html");

        remoteMain.enable(win.webContents);

        win.webContents.on("did-finish-load", () => {
            Page.ready("guide");
            DevToolsManager.autoShow(win);
        });
        DevToolsManager.register("Guide", win);
        // win.webContents.setWindowOpenHandler(({url}) => {
        //     if (url.startsWith('https:')) shell.openExternal(url)
        //     return {action: 'deny'}
        // })
        Page.registerWindow(PageGuide.NAME, win);
    },
};
