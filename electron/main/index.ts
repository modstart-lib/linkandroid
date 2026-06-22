import {optimizer} from '@electron-toolkit/utils'
import {app, BrowserWindow, desktopCapturer, session, shell} from 'electron'
import fs from 'node:fs'
import path from 'node:path'

/** process.js 必须位于非依赖项的顶部 */
import {isDummy} from '../lib/process'
import {ensureClientConfig} from '../lib/client-config'
import {AppEnv, AppRuntime} from '../mapi/env'
import {MAPI} from '../mapi/main'

import {AppConfig} from '../../src/config'
import {ConfigContextMenu} from '../config/contextMenu'
import {icnsLogoPath, icoLogoPath, logoPath} from '../config/icon'
import {ConfigLang} from '../config/lang'
import {ConfigMenu} from '../config/menu'
import {ConfigTray} from '../config/tray'
import {WindowConfig} from '../config/window'
import {DevToolsManager} from '../lib/devtools'
import {isMac, isPackaged} from '../lib/env'
import {preloadDefault, rendererLoadPath} from '../lib/env-main'
import {executeHooks} from '../lib/hooks'
import {AppsMain} from '../mapi/app/main'
import {reportError} from '../mapi/log/beacon'
import Log from '../mapi/log/main'
import {Page} from '../page'

const isDummyNew = isDummy

if (process.env['ELECTRON_ENV_PROD']) {
    DevToolsManager.setEnable(false)
}

process.on('uncaughtException', (reason) => {
    let error: any = reason
    if (error instanceof Error) {
        error = [error.message, error.stack].join('\n')
    }
    Log.error('UncaughtException', error)
    reportError(
        reason instanceof Error ? reason.message : String(reason),
        reason instanceof Error ? reason.stack : undefined,
    )
})

process.on('unhandledRejection', (reason) => {
    Log.error('UnhandledRejection', reason)
    let error: any = reason
    if (error instanceof Error) {
        error = [error.message, error.stack].join('\n')
    }
    Log.error('UnhandledRejection', error)
    reportError(
        reason instanceof Error ? (reason as Error).message : String(reason),
        reason instanceof Error ? (reason as Error).stack : undefined,
    )
})

app.disableHardwareAcceleration()

// Set application name for Windows 10+ notifications
if (process.platform === 'win32') app.setAppUserModelId(app.getName())

if (!app.requestSingleInstanceLock()) {
    // 如何激活已经启动的实例？
    // https://www.electronjs.org/docs/api/app#apprequestsingleinstancelock
    // 测试模式（--remote-debugging-port=53031）下跳过单实例检查
    if (
        !process.argv.includes('--remote-debugging-port=53031') &&
        !process.argv.some((a) => a.startsWith('--remote-debugging-port='))
    ) {
        app.quit()
        process.exit(0)
    }
}

const hasSplashWindow = true

AppEnv.appRoot = process.env.APP_ROOT
AppEnv.appData = app.getPath('appData')
AppEnv.userData = app.getPath('userData')

// ~/.linkandroid/client.json → dataPath（默认 ~/.linkandroid/data）
const clientConfig = ensureClientConfig()
AppEnv.dataRoot = clientConfig.dataPath

if (!fs.existsSync(AppEnv.dataRoot)) {
    fs.mkdirSync(AppEnv.dataRoot, {recursive: true})
}
for (const dir of ['db', 'logs', 'storage']) {
    if (!fs.existsSync(path.join(AppEnv.dataRoot, dir))) {
        fs.mkdirSync(path.join(AppEnv.dataRoot, dir), {recursive: true})
    }
}

AppEnv.isInit = true

MAPI.init()
ConfigContextMenu.init()

Log.info('Starting')
Log.info('LaunchInfo', {
    isPackaged,
    userData: AppEnv.userData,
    dataRoot: AppEnv.dataRoot,
})

async function createWindow() {
    let icon = logoPath
    if (process.platform === 'win32') {
        icon = icoLogoPath
    } else if (process.platform === 'darwin') {
        icon = icnsLogoPath
    }
    if (hasSplashWindow) {
        AppRuntime.splashWindow = new BrowserWindow({
            title: AppConfig.title,
            width: 600,
            height: 350,
            transparent: false,
            frame: false,
            alwaysOnTop: true,
            hasShadow: true,
            skipTaskbar: true,
        })
        rendererLoadPath(AppRuntime.splashWindow, 'splash.html')
    }
    AppRuntime.mainWindow = new BrowserWindow({
        show: true,
        title: AppConfig.title,
        ...(!isPackaged ? {icon} : {}),
        frame: false,
        transparent: false,
        hasShadow: true,
        center: true,
        minWidth: WindowConfig.initWidth,
        minHeight: WindowConfig.initHeight,
        width: WindowConfig.initWidth,
        height: WindowConfig.initHeight,
        backgroundColor: await AppsMain.defaultDarkModeBackgroundColor(),
        titleBarStyle: 'hidden',
        trafficLightPosition: {x: 10, y: 11},
        webPreferences: {
            preload: preloadDefault,
            // Warning: Enable nodeIntegration and disable contextIsolation is not secure in production
            nodeIntegration: true,
            webSecurity: false,
            webviewTag: true,
            backgroundThrottling: false,
            // Consider using contextBridge.exposeInMainWorld
            // Read more on https://www.electronjs.org/docs/latest/tutorial/context-isolation
            contextIsolation: false,
            // sandbox: false,
        },
    })

    AppRuntime.mainWindow.on('closed', () => {
        AppRuntime.mainWindow = null
    })
    AppRuntime.mainWindow.on('show', async () => {
        await executeHooks(AppRuntime.mainWindow, 'Show')
    })
    AppRuntime.mainWindow.on('hide', async () => {
        await executeHooks(AppRuntime.mainWindow, 'Hide')
    })

    if (isMac) {
        AppRuntime.mainWindow.on('close', (event) => {
            // @ts-ignore
            if (!app.quitForce) {
                executeHooks(AppRuntime.mainWindow, 'ShowQuitConfirmDialog')
                event.preventDefault()
            }
        })
    }
    AppRuntime.mainWindow.on('enter-full-screen', () => {
        executeHooks(AppRuntime.mainWindow, 'EnterFullScreen')
    })
    AppRuntime.mainWindow.on('leave-full-screen', () => {
        executeHooks(AppRuntime.mainWindow, 'LeaveFullScreen')
    })

    rendererLoadPath(AppRuntime.mainWindow, 'index.html')
    DevToolsManager.register('Main', AppRuntime.mainWindow)

    AppRuntime.mainWindow.webContents.on('did-finish-load', () => {
        if (hasSplashWindow) {
            setTimeout(() => {
                try {
                    AppRuntime.splashWindow?.close()
                    AppRuntime.splashWindow = null
                } catch (e) {}
            }, 1000)
        }
        Page.ready('main')
        DevToolsManager.autoShow(AppRuntime.mainWindow)
        if (isMac) {
            app.dock.show()
            app.focus({steal: true})
        }
        AppRuntime.mainWindow.show()
        AppRuntime.mainWindow.focus()
    })
    AppRuntime.mainWindow.webContents.setWindowOpenHandler(({url}) => {
        if (url.startsWith('https:')) shell.openExternal(url)
        return {action: 'deny'}
    })
}

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
        createWindow().then()
    })

app.on('will-quit', () => {
    MAPI.destroy()
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
})

app.on('second-instance', () => {
    if (AppRuntime.mainWindow) {
        if (AppRuntime.mainWindow.isMinimized()) {
            AppRuntime.mainWindow.restore()
        }
        AppRuntime.mainWindow.show()
        AppRuntime.mainWindow.focus()
    }
})

app.on('activate', () => {
    const allWindows = BrowserWindow.getAllWindows()
    if (allWindows.length) {
        if (!AppRuntime.mainWindow.isVisible()) {
            AppRuntime.mainWindow.show()
        }
        AppRuntime.mainWindow.focus()
    } else {
        createWindow().then()
    }
})
