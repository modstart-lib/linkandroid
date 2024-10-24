import {app, Menu, Tray} from 'electron'
import {trayPath} from "./icon";
import {AppRuntime} from "../mapi/env";
import {AppConfig} from "../../src/config";
import {t} from "./lang";
import {isMac, isWin} from "../lib/env";

let tray = null

const showApp = () => {
    if (isMac) {
        app.dock.show()
    }
    AppRuntime.mainWindow.show()
}

const hideApp = () => {
    if (isMac) {
        app.dock.hide()
    }
    AppRuntime.mainWindow.hide()
}

const quitApp = () => {
    app.quit()
}

const ready = () => {
    tray = new Tray(trayPath)

    tray.setToolTip(AppConfig.name)

    if (isWin) {
        tray.on('click', () => {
            showApp()
        })
    }

    const contextMenu = Menu.buildFromTemplate([
        {
            label: t('显示主界面'),
            click: () => {
                showApp()
            },
        },
        {
            label: t('重启'),
            click: () => {
                app.relaunch()
                quitApp()
            },
        },
        {
            label: t('退出'),
            click: () => {
                quitApp()
            },
        },
    ])

    tray.setContextMenu(contextMenu)
}

const show = () => {

    if (tray) {
        tray.destroy()
        tray = null
    }
}


export const ConfigTray = {
    ready
}
