import {BrowserWindow, ipcMain} from "electron";
import {preloadDefault, rendererLoadPath} from "../lib/env-main";
import {Page} from "./index";
import {AppConfig} from "../../src/config";
import {icnsLogoPath, icoLogoPath, logoPath} from "../config/icon";
import {isPackaged} from "../lib/env";
import {WindowConfig} from "../config/window";
import * as remoteMain from "@electron/remote/main";
import {DevToolsManager} from "../lib/devtools";

export const PagePayment = {
    NAME: 'payment',
    event: {
        onRefresh: null,
        onWatch: null,
        onClose: null,
    },
    open: async (option: {
        onRefresh: () => Promise<{
            payUrl: string,
            watchUrl: string,
            payExpireSeconds: number,
            body: string,
        }>,
        onWatch: () => Promise<{
            status: 'WaitPay' | 'Scanned' | 'Payed' | 'Expired' | 'Error',
        }>,
        onClose: () => void,
        parent?: BrowserWindow,
    }): Promise<{
        close: () => void,
    }> => {
        PagePayment.event.onRefresh = option.onRefresh
        PagePayment.event.onWatch = option.onWatch
        PagePayment.event.onClose = option.onClose
        let icon = logoPath
        if (process.platform === 'win32') {
            icon = icoLogoPath
        } else if (process.platform === 'darwin') {
            icon = icnsLogoPath
        }
        let parent = option.parent || null
        let alwaysOnTop = !parent
        const win = new BrowserWindow({
            show: true,
            title: AppConfig.name,
            ...(!isPackaged ? {icon} : {}),
            frame: false,
            transparent: false,
            hasShadow: true,
            center: true,
            useContentSize: true,
            minWidth: WindowConfig.paymentWidth,
            minHeight: WindowConfig.paymentHeight,
            width: WindowConfig.paymentWidth,
            height: WindowConfig.paymentHeight,
            skipTaskbar: true,
            resizable: false,
            maximizable: false,
            backgroundColor: '#f1f5f9',
            focusable: true,
            parent,
            alwaysOnTop,
            webPreferences: {
                preload: preloadDefault,
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

        win.on('closed', () => {
            Page.unregisterWindow(PagePayment.NAME)
            PagePayment.event.onClose()
        })

        rendererLoadPath(win, 'page/payment.html');

        remoteMain.enable(win.webContents)

        win.webContents.on('did-finish-load', () => {
            Page.ready('payment')
            DevToolsManager.autoShow(win)
            win.focus()
        })
        DevToolsManager.register('Payment', win)
        // win.webContents.setWindowOpenHandler(({url}) => {
        //     if (url.startsWith('https:')) shell.openExternal(url)
        //     return {action: 'deny'}
        // })
        Page.registerWindow(PagePayment.NAME, win)

        return {
            close: () => {
                win.close()
            }
        }
    }
}

ipcMain.handle('Payment.Event', async (event, type: 'refresh' | 'watch', param: any) => {
    switch (type) {
        case 'refresh':
            return await PagePayment.event.onRefresh()
        case 'watch':
            return await PagePayment.event.onWatch()
    }
})

