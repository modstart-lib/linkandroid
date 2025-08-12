import {Events} from "../mapi/event/main";
import {AppEnv, AppRuntime} from "../mapi/env";
import {PageUser} from "./user";
import {PageThirdPartyImageBeautifier} from "./thirdPartyImageBeautifier";
import {BrowserWindow, shell} from "electron";
import {rendererLoadPath} from "../lib/env-main";
import {PageGuide} from "./guide";
import {PageSetup} from "./setup";
import {DevToolsManager} from "../lib/devtools";
import {PageFeedback} from "./feedback";
import {PagePayment} from "./payment";
import {PageMonitor} from "./monitor";
import {PageLog} from "./log";

const Pages = {
    thirdPartyImageBeautifier: PageThirdPartyImageBeautifier,
    user: PageUser,
    guide: PageGuide,
    setup: PageSetup,
    payment: PagePayment,
    feedback: PageFeedback,
    monitor: PageMonitor,
    log: PageLog,
};

export const Page = {
    ready(name: string) {
        Events.send(name, "APP_READY", {
            name,
            AppEnv,
        });
    },
    openWindow: (name: string, win: BrowserWindow, fileName: string) => {
        win.webContents.on("will-navigate", event => {
            event.preventDefault();
        });
        win.webContents.setWindowOpenHandler(() => {
            return {action: "deny"};
        });
        win.webContents.setWindowOpenHandler(({url}) => {
            if (url.startsWith("https:") || url.startsWith("http:")) {
                shell.openExternal(url).then();
            }
            return {action: "deny"};
        });
        win.on("close", () => {
            delete AppRuntime.windows[name];
        });
        const promise = new Promise((resolve, reject) => {
            win.webContents.on("did-finish-load", () => {
                win.focus();
                Page.ready(name);
                DevToolsManager.autoShow(win);
                resolve(undefined);
            });
        });
        rendererLoadPath(win, fileName);
        DevToolsManager.register(`Page.${name}`, win);
        AppRuntime.windows[name] = win;
        return promise;
    },
    open: async (
        name: string,
        option?: {
            singleton?: boolean;
            parent?: BrowserWindow;
            [key: string]: any;
        }
    ) => {
        option = Object.assign(
            {
                singleton: true,
                parent: null,
            },
            option
        );
        if (!option.parent) {
            option.parent = AppRuntime.mainWindow;
        }
        if (option.singleton && AppRuntime.windows[name]) {
            AppRuntime.windows[name].show();
            AppRuntime.windows[name].focus();
            AppRuntime.windows[name].setParentWindow(option.parent);
            return;
        }
        return Pages[name].open(option);
    },
    registerWindow(name: string, win: BrowserWindow) {
        AppRuntime.windows[name] = win;
    },
    unregisterWindow(name: string) {
        delete AppRuntime.windows[name];
    },
};
