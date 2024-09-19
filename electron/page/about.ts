import {BrowserWindow} from "electron";
import {rendererPath} from "../util/path-main";


export const PageAbout = {
    create() {
        const win = new BrowserWindow({
            minWidth: 600,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false,
                webSecurity: false,
            },
            show: true,
        });

        rendererPath(win, "page/about.html");

        // await win.webContents.session.setProxy(store.get("代理"));

        win.webContents.openDevTools();

        win.webContents.on("did-finish-load", () => {
            // win.webContents.setZoomFactor(store.get("全局.缩放") || 1.0);
            // win.webContents.send("about", about);
        });
    }
}
