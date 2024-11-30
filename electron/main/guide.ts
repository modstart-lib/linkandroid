import {icnsLogoPath, icoLogoPath, logoPath} from "../config/icon";
import {AppRuntime} from "../mapi/env";
import {AppConfig} from "../../src/config";
import {isPackaged} from "../lib/env";
import {WindowConfig} from "../config/window";
import {MAIN_DIST, RENDERER_DIST, VITE_DEV_SERVER_URL} from "../lib/env-main";
import * as remoteMain from "@electron/remote/main";
import {Page} from "../page";
import {BrowserWindow} from "electron";
import path from "node:path";
import {executeHooks} from "../mapi/manager/lib/hooks";
import {DevToolsManager} from "../lib/devtools";

export const GuideMain = {
    init() {
        const preload = path.join(MAIN_DIST, 'preload/index.mjs')
        const guideHtml = path.join(RENDERER_DIST, 'page/guide.html')
        let icon = logoPath
        if (process.platform === 'win32') {
            icon = icoLogoPath
        } else if (process.platform === 'darwin') {
            icon = icnsLogoPath
        }
        AppRuntime.guideWindow = new BrowserWindow({
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
            backgroundColor: '#f1f5f9',
            alwaysOnTop: true,
            webPreferences: {
                preload,
                // Warning: Enable nodeIntegration and disable contextIsolation is not secure in production
                nodeIntegration: true,
                webSecurity: false,
                webviewTag: true,
                // Consider using contextBridge.exposeInMainWorld
                // Read more on https://www.electronjs.org/docs/latest/tutorial/context-isolation
                contextIsolation: false,
                // sandbox: false,
            },
        })

        AppRuntime.guideWindow.on('closed', () => {
            AppRuntime.guideWindow = null
        })
        // AppRuntime.guideWindow.on('show', async () => {
        //     await executeHooks(AppRuntime.guideWindow, 'Show')
        // });
        // AppRuntime.guideWindow.on('hide', async () => {
        //     await executeHooks(AppRuntime.guideWindow, 'Hide')
        // });
        // AppRuntime.guideWindow.on('blur', async () => {
        //     AppRuntime.guideWindow.hide()
        // })

        // console.log('VITE_DEV_SERVER_URL:', VITE_DEV_SERVER_URL)
        if (VITE_DEV_SERVER_URL) { // #298
            AppRuntime.guideWindow.loadURL(VITE_DEV_SERVER_URL + 'page/guide.html')
        } else {
            AppRuntime.guideWindow.loadFile(guideHtml)
        }

        remoteMain.enable(AppRuntime.guideWindow.webContents)

        AppRuntime.guideWindow.webContents.on('did-finish-load', () => {
            Page.ready('guide')
            DevToolsManager.autoShow(AppRuntime.guideWindow)
        })
        DevToolsManager.register('Guide', AppRuntime.guideWindow)
        // AppRuntime.guideWindow.webContents.setWindowOpenHandler(({url}) => {
        //     if (url.startsWith('https:')) shell.openExternal(url)
        //     return {action: 'deny'}
        // })
    },
}
