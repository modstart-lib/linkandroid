import {app, Menu, nativeImage, Tray} from 'electron'
import {existsSync} from 'node:fs'
import {AppConfig} from '../../src/config'
import {isMac, isWin} from '../lib/env'
import {extraResolve} from '../lib/env'
import {AppRuntime} from '../mapi/env'
import {trayPath} from './icon'
import {t} from './lang'

let tray = null

const getTrayImage = () => {
    const iconPath = existsSync(trayPath) ? trayPath : extraResolve('common/tray/icon.png')
    const image = nativeImage.createFromPath(iconPath)
    if (image.isEmpty()) {
        return null
    }
    if (isMac) {
        image.setTemplateImage(true)
    }
    return image
}

const showApp = () => {
    if (isMac) {
        app.dock.show()
        app.focus({steal: true})
    }
    AppRuntime.mainWindow.show()
    AppRuntime.mainWindow.focus()
}

const hideApp = () => {
    if (isMac) {
        app.dock.hide()
    }
    AppRuntime.mainWindow.hide()
}

const quitApp = () => {
    // @ts-ignore
    app.quitForce = true
    app.quit()
}

const ready = () => {
    const image = getTrayImage()
    if (!image) {
        return
    }
    tray = new Tray(image)

    tray.setToolTip(AppConfig.title)

    if (isWin) {
        tray.on('click', () => {
            showApp()
        })
    }

    const contextMenu = Menu.buildFromTemplate([
        {
            label: t('tray.showMain'),
            click: () => {
                showApp()
            },
        },
        {
            label: t('tray.restart'),
            click: () => {
                app.relaunch()
                quitApp()
            },
        },
        {
            label: t('menu.quit'),
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
    ready,
}
