import {BrowserWindow} from "electron";
import {preloadDefault} from "../lib/env-main";
import {AppRuntime} from "../mapi/env";
import {t} from "../config/lang";
import {Page} from "./index";

export const PageUser = {
    NAME: "user",
    open: async (option: { parent?: BrowserWindow }) => {
        option = Object.assign({
            parent: null
        }, option)
        let alwaysOnTop = !option.parent;
        const win = new BrowserWindow({
            title: t("用户中心"),
            minWidth: 700,
            minHeight: 500,
            width: 700,
            height: 500,
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
            focusable: true,
            parent: option.parent,
            alwaysOnTop,
        });
        return Page.openWindow(PageUser.NAME, win, "page/user.html");
    },
};
