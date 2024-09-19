import {BrowserWindow} from "electron";
import {preloadDefault, rendererPath} from "../util/path-main";
import {AppRuntime} from "../mapi/env";


export const PageAbout = {
    create() {
        const win = new BrowserWindow({
            minWidth: 600,
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

        rendererPath(win, "page/about.html");

        // await win.webContents.session.setProxy(store.get("代理"));

        // win.webContents.openDevTools();

        win.webContents.on("did-finish-load", () => {
            // win.webContents.setZoomFactor(store.get("全局.缩放") || 1.0);
            // win.webContents.send("about", about);
        });

        AppRuntime.windows['about'] = win;
    }
}
