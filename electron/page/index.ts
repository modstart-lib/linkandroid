import {Events} from "../mapi/event/main";
import {AppEnv, AppRuntime} from "../mapi/env";
import {PageUser} from "./user";
import {PageThirdPartyImageBeautifier} from "./thirdPartyImageBeautifier";
import {BrowserWindow, shell} from "electron";
import {rendererLoadPath} from "../lib/env-main";

const Pages = {
    'thirdPartyImageBeautifier': PageThirdPartyImageBeautifier,
    'user': PageUser,
}

export const Page = {
    ready(name: string) {
        Events.send(name, 'APP_READY', {
            name,
            AppEnv
        })
    },
    openWindow: (name: string, win: BrowserWindow, fileName: string) => {
        win.webContents.on("will-navigate", (event) => {
            event.preventDefault();
        });
        win.webContents.setWindowOpenHandler(() => {
            return {action: "deny"};
        });
        win.webContents.setWindowOpenHandler(({url}) => {
            if (url.startsWith('https:') || url.startsWith('http:')) {
                shell.openExternal(url).then()
            }
            return {action: 'deny'}
        })
        win.on('close', () => {
            delete AppRuntime.windows[name]
        })
        const promise = new Promise((resolve, reject) => {
            win.webContents.on("did-finish-load", () => {
                Page.ready(name);
                resolve(undefined);
            });
        });
        rendererLoadPath(win, fileName);
        AppRuntime.windows[name] = win
        return promise
    },
    open: async (name: string, option: any) => {
        return Pages[name].open(option)
    }
}

