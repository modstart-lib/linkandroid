import {Events} from "../mapi/event/main";
import {AppEnv, AppRuntime} from "../mapi/env";
import {PageThirdPartyImageBeautifier} from "./thirdPartyImageBeautifier";
import {BrowserWindow, shell} from "electron";
import {rendererPath} from "../util/path-main";

const Pages = {
    'thirdPartyImageBeautifier': PageThirdPartyImageBeautifier,
}

export const Page = {
    ready(name: string) {
        Events.send(name, 'APP_READY', {
            name,
            AppEnv
        })
    },
    openWindow: (name: string, win: BrowserWindow, fileName: string) => {
        rendererPath(win, fileName);
        AppRuntime.windows[name] = win
        win.webContents.setWindowOpenHandler(({url}) => {
            if (url.startsWith('https:') || url.startsWith('http:')) {
                shell.openExternal(url).then()
            }
            return {action: 'deny'}
        })
        win.on('close', () => {
            delete AppRuntime.windows[name]
        })
        return new Promise((resolve, reject) => {
            win.webContents.on("did-finish-load", () => {
                Page.ready(name);
                resolve(undefined);
            });
        });
    },
    open: async (name: string, option: any) => {
        return Pages[name].open(option)
    }
}

