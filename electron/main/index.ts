import {app, BrowserWindow, Menu, shell} from 'electron'
import {optimizer} from '@electron-toolkit/utils'
import {createRequire} from 'node:module'
import {fileURLToPath} from 'node:url'
import path from 'node:path'
import os from 'node:os'

/** process.js 必须位于非依赖项的顶部 */
import {isPackaged} from "../util/process";

import {AppEnv, AppRuntime} from "../mapi/env";
import {MAPI} from '../mapi/main';

import {WindowConstant} from "../lib/constant";
import {AppConfig} from "../../src/config";

import {buildResolve} from "../util/path";
import Log from "../mapi/log";
import Event from "../mapi/event";

const isMac = process.platform === 'darwin'
const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const logoPath = buildResolve('logo.png')
export const icoLogoPath = buildResolve('logo.ico')
export const icnsLogoPath = buildResolve('logo.icns')

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
process.env.APP_ROOT = path.join(__dirname, '../..')

// Menu.setApplicationMenu(null);

export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')
export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
    ? path.join(process.env.APP_ROOT, 'public')
    : RENDERER_DIST

// Disable GPU Acceleration for Windows 7
if (os.release().startsWith('6.1')) app.disableHardwareAcceleration()

// Set application name for Windows 10+ notifications
if (process.platform === 'win32') app.setAppUserModelId(app.getName())

if (!app.requestSingleInstanceLock()) {
    app.quit()
    process.exit(0)
}

const hasSplashWindow = true

const preload = path.join(__dirname, '../preload/index.mjs')
const splashHtml = path.join(RENDERER_DIST, 'splash.html')
const indexHtml = path.join(RENDERER_DIST, 'index.html')

AppEnv.appRoot = process.env.APP_ROOT
AppEnv.appData = app.getPath('appData')
AppEnv.userData = app.getPath('userData')
AppEnv.isInit = true

MAPI.init()

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
            width: 600,
            height: 350,
            transparent: false,
            frame: false,
            alwaysOnTop: true,
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
            webviewTag: true

            // Consider using contextBridge.exposeInMainWorld
            // Read more on https://www.electronjs.org/docs/latest/tutorial/context-isolation
            // contextIsolation: false,
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
        Event.send('APP_READY', AppEnv)
    })

    // Make all links open with the browser, not with the application
    AppRuntime.mainWindow.webContents.setWindowOpenHandler(({url}) => {
        if (url.startsWith('https:')) shell.openExternal(url)
        return {action: 'deny'}
    })
    // AppRuntime.mainWindow.webContents.on('will-navigate', (event, url) => { }) #344
}

app.whenReady()
    .then(() => {
        MAPI.ready()
        app.on('browser-window-created', (_, window) => {
            optimizer.watchWindowShortcuts(window)
        })
        createWindow()
    })

app.on('will-quit', () => {
    MAPI.destroy()
});

app.on('window-all-closed', () => {
    AppRuntime.mainWindow = null
    if (process.platform !== 'darwin') app.quit()
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
