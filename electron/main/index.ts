import {app, BrowserWindow, desktopCapturer, session, shell} from 'electron'
import {optimizer} from '@electron-toolkit/utils'
import path from 'node:path'
import os from 'node:os'

/** process.js 必须位于非依赖项的顶部 */
import {isPackaged} from "../util/process";

import {AppEnv, AppRuntime} from "../mapi/env";
import {MAPI} from '../mapi/main';

import {WindowConstant} from "../lib/constant";
import {AppConfig} from "../../src/config";
import Log from "../mapi/log/main";
import {ConfigMenu} from "../config/menu";
import {ConfigLang} from "../config/lang";
import {ConfigContextMenu} from "../config/contextMenu";
import {MAIN_DIST, RENDERER_DIST, VITE_DEV_SERVER_URL} from "../util/path-main";
import {Page} from "../page";
import {ConfigTray} from "../config/tray";
import {icnsLogoPath, icoLogoPath, logoPath} from "../config/icon";

// The built directory structure
//
// ├─┬ dist-electron
// │ ├─┬ main
// │ │ └── index.js    > Electron-Main
// │ └─┬ preload
// │   └── index.mjs   > Preload-Scripts
// ├─┬ dist
// │ └── index.html    > Electron-Renderer
//

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason) => {
    console.error('Unhandled Rejection:', reason);
});

// Disable GPU Acceleration for Windows 7
if (os.release().startsWith('6.1')) app.disableHardwareAcceleration()

// Set application name for Windows 10+ notifications
if (process.platform === 'win32') app.setAppUserModelId(app.getName())

if (!app.requestSingleInstanceLock()) {
    app.quit()
    process.exit(0)
}

const hasSplashWindow = true

const preload = path.join(MAIN_DIST, 'preload/index.mjs')
const splashHtml = path.join(RENDERER_DIST, 'splash.html')
const indexHtml = path.join(RENDERER_DIST, 'index.html')

AppEnv.appRoot = process.env.APP_ROOT
AppEnv.appData = app.getPath('appData')
AppEnv.userData = app.getPath('userData')
AppEnv.isInit = true

MAPI.init()
ConfigContextMenu.init()

Log.info('Starting')
Log.info('LaunchInfo', {
    splash: splashHtml,
    index: indexHtml,
    isPackaged
})
Log.info('UserDataDir', AppEnv.userData)

function createWindow() {
    let icon = logoPath
    if (process.platform === 'win32') {
        icon = icoLogoPath
    } else if (process.platform === 'darwin') {
        icon = icnsLogoPath
    }
    if (hasSplashWindow) {
        AppRuntime.splashWindow = new BrowserWindow({
            title: AppConfig.name,
            width: 600,
            height: 350,
            transparent: true,
            frame: false,
            alwaysOnTop: true,
            hasShadow: true,
        })
        if (VITE_DEV_SERVER_URL) {
            AppRuntime.splashWindow.loadURL(path.join(VITE_DEV_SERVER_URL, 'splash.html'))
        } else {
            AppRuntime.splashWindow.loadFile(splashHtml)
        }
    }
    AppRuntime.mainWindow = new BrowserWindow({
        show: !hasSplashWindow,
        title: AppConfig.name,
        ...(!isPackaged ? {icon} : {}),
        frame: false,
        transparent: true,
        hasShadow: true,
        center: true,
        minWidth: WindowConstant.initWidth,
        minHeight: WindowConstant.initHeight,
        width: WindowConstant.initWidth,
        height: WindowConstant.initHeight,
        backgroundColor: '#f1f5f9',
        webPreferences: {
            preload,
            // Warning: Enable nodeIntegration and disable contextIsolation is not secure in production
            nodeIntegration: true,
            webSecurity: false,
            webviewTag: true,
            // Consider using contextBridge.exposeInMainWorld
            // Read more on https://www.electronjs.org/docs/latest/tutorial/context-isolation
            contextIsolation: false,
            // sandbox: false,
        },
    })

    // console.log('VITE_DEV_SERVER_URL:', VITE_DEV_SERVER_URL)
    if (VITE_DEV_SERVER_URL) { // #298
        AppRuntime.mainWindow.loadURL(VITE_DEV_SERVER_URL)
    } else {
        AppRuntime.mainWindow.loadFile(indexHtml)
    }

    AppRuntime.mainWindow.webContents.on('did-finish-load', () => {
        if (hasSplashWindow) {
            AppRuntime.mainWindow?.show()
            setTimeout(() => {
                AppRuntime.splashWindow?.close()
                AppRuntime.splashWindow = null
                if (!isPackaged) {
                    AppRuntime.mainWindow.webContents.openDevTools()
                }
            }, 1000);
        }
        Page.ready('main')
    })
    AppRuntime.mainWindow.webContents.setWindowOpenHandler(({url}) => {
        if (url.startsWith('https:')) shell.openExternal(url)
        return {action: 'deny'}
    })
}

app.disableHardwareAcceleration();

app.whenReady()
    .then(() => {
        session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
            desktopCapturer.getSources({types: ['screen']}).then((sources) => {
                // Grant access to the first screen found.
                callback({video: sources[0], audio: 'loopback'})
            })
        })
    })
    .then(ConfigLang.readyAsync)
    .then(() => {
        MAPI.ready()
        ConfigMenu.ready()
        ConfigTray.ready()
        app.on('browser-window-created', (_, window) => {
            optimizer.watchWindowShortcuts(window)
        })
        createWindow()
    })

app.on('will-quit', () => {
    MAPI.destroy()
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
    AppRuntime.mainWindow = null
})

app.on('second-instance', () => {
    if (AppRuntime.mainWindow) {
        // Focus on the main window if the user tried to open another
        if (AppRuntime.mainWindow.isMinimized()) AppRuntime.mainWindow.restore()
        AppRuntime.mainWindow.focus()
    }
})

app.on('activate', () => {
    const allWindows = BrowserWindow.getAllWindows()
    if (allWindows.length) {
        allWindows[0].focus()
    } else {
        createWindow()
    }
})


// New window example arg: new windows url
// ipcMain.handle('open-win', (_, arg) => {
//     const childWindow = new BrowserWindow({
//         webPreferences: {
//             preload,
//             nodeIntegration: true,
//             contextIsolation: false,
//         },
//     })
//
//     if (VITE_DEV_SERVER_URL) {
//         childWindow.loadURL(`${VITE_DEV_SERVER_URL}#${arg}`)
//     } else {
//         childWindow.loadFile(indexHtml, {hash: arg})
//     }
// })
