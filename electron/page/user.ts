import {BrowserWindow, shell} from "electron";
import {preloadDefault} from "../lib/env-main";
import {AppRuntime} from "../mapi/env";
import {t} from "../config/lang";
import {Page} from "./index";
import {AppConfig} from "../../src/config";
import {User} from "../mapi/user/main";

export const PageUser = {
    NAME: 'user',
    open: async (option: any) => {
        const win = new BrowserWindow({
            title: t('用户中心'),
            parent: AppRuntime.mainWindow,
            minWidth: 800,
            minHeight: 600,
            width: 800,
            height: 600,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false,
                webSecurity: false,
                preload: preloadDefault,
                webviewTag: true,
            },
            show: true,
            frame: false,
            center: true,
            transparent: false,
        });
        win.webContents.on('did-attach-webview', function (e, webContent) {
            webContent.on('will-navigate', function (e, url) {
                const urlPath = new URL(url).pathname
                const whiteList = [
                    '/member_vip',
                    '/app_manager/user',
                    '/login',
                    '/register',
                    '/logout',
                ]
                if (whiteList.includes(urlPath)) return
                e.preventDefault()
                User.getApiToken().then(apiToken => {
                    url = `${AppConfig.apiBaseUrl}/app_manager/enter?url=` + encodeURIComponent(url) + `&api_token=${apiToken}`
                    shell.openExternal(url)
                })
            })
        })
        return Page.openWindow(PageUser.NAME, win, "page/user.html");
    }
}
