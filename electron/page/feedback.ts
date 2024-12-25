import {BrowserWindow} from "electron";
import {preloadDefault} from "../lib/env-main";
import {AppRuntime} from "../mapi/env";
import {t} from "../config/lang";
import {Page} from "./index";
import {WindowConfig} from "../config/window";

export const PageFeedback = {
    NAME: 'feedback',
    open: async (option: any) => {
        const win = new BrowserWindow({
            title: t('工单反馈'),
            parent: AppRuntime.mainWindow,
            minWidth: WindowConfig.feedbackWidth,
            minHeight: WindowConfig.feedbackHeight,
            width: WindowConfig.feedbackWidth,
            height: WindowConfig.feedbackHeight,
            webPreferences: {
                preload: preloadDefault,
                // Warning: Enable nodeIntegration and disable contextIsolation is not secure in production
                nodeIntegration: true,
                webSecurity: false,
                webviewTag: true,
                // Consider using contextBridge.exposeInMainWorld
                // Read more on https://www.electronjs.org/docs/latest/tutorial/context-isolation
                contextIsolation: false,
            },
            show: true,
            frame: false,
            transparent: false,
        });
        return Page.openWindow(PageFeedback.NAME, win, "page/feedback.html");
    }
}
