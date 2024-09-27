import {BrowserWindow} from "electron";
import {preloadDefault} from "../lib/env-main";
import {AppRuntime} from "../mapi/env";
import {t} from "../config/lang";
import {Page} from "./index";

export const PageAbout = {
    NAME: 'about',
    open: async (option: any) => {
        const win = new BrowserWindow({
            title: t('关于'),
            parent: AppRuntime.mainWindow,
            minWidth: 800,
            minHeight: 600,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false,
                webSecurity: false,
                preload: preloadDefault
            },
            show: true,
            frame: false,
            transparent: false,
        });
        return Page.openWindow(PageAbout.NAME, win, "page/about.html");
    }
}
