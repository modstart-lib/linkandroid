import {app, Menu, Tray} from 'electron'
import {trayPath} from "./icon";
import {AppRuntime} from "../mapi/env";
import {AppConfig} from "../../src/config";
import {t} from "./lang";

let tray = null

const showApp = () => {
    AppRuntime.mainWindow.show()
}

const hideApp = () => {
    AppRuntime.mainWindow.hide()
}

const quitApp = () => {
    app.quit()
}

const ready = () => {
    if (process.platform === 'darwin') {
        app.dock.show()
    }
    tray = new Tray(trayPath)

    tray.setToolTip(AppConfig.name)

    const contextMenu = Menu.buildFromTemplate([
        {
            label: ('显示主界面'),
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
