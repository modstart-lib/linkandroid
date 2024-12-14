import {BrowserView, BrowserWindow, screen} from "electron";
import {isDev} from "./env";
import {WindowConfig} from "../config/window";

export const DevToolsManager = {
    enable: true,
    rowCount: 4,
    colCount: 3,
    windows: new Map<BrowserWindow | BrowserView, BrowserWindow>(),
    setEnable(enable: boolean) {
        DevToolsManager.enable = enable
    },
    getWindow(win: BrowserWindow | BrowserView) {
        return this.windows.get(win);
    },
    getOrCreateWindow(name: string, win: BrowserWindow | BrowserView) {
        if (this.windows.has(win)) {
            return this.windows.get(win);
        }
        const {x, y, width, height} = this.getDisplayPosition()
        // console.log('DevToolsManager', name, {x, y, width, height})
        const devtools = new BrowserWindow({
            show: true,
            x,
            y,
            width,
            height,
            title: name,
        });
        // console.log('DevToolsManager', name, {x, y})
        win.webContents.setDevToolsWebContents(devtools.webContents);
        win.webContents.on('destroyed', () => {
            // console.log('DevToolsManager', 'destroyed', name)
            devtools.destroy()
            this.windows.delete(win)
        })
        devtools.webContents.on('dom-ready', () => {
            setTimeout(() => {
                if (!devtools.isDestroyed()) {
                    devtools.setTitle(name)
                }
            }, 1000)
        })
        this.windows.set(win, devtools);
        return devtools;
    },
    getLargestDisplay(): Electron.Display {
        const displays = screen.getAllDisplays();
        return displays.reduce((max, display) => {
            const {width, height} = display.size;
            const maxResolution = max.size.width * max.size.height;
            const currentResolution = width * height;
            return currentResolution > maxResolution ? display : max;
        });
    },
    getDisplayPosition(): {
        x: number, y: number,
        width: number, height: number
    } {
        const display = this.getLargestDisplay()
        const {x, y, width, height} = display.workArea;
        // console.log('DevToolsManager', 'getDisplayPosition', {x, y, width, height})
        if (width < 1300) {
            this.rowCount = 3
            this.colCount = 2
        }
        const itemWidth = Math.floor(width / this.rowCount);
        const itemHeight = Math.floor(height / this.colCount);
        const maxRow = Math.floor(width / itemWidth);
        const row = this.windows.size % maxRow;
        const col = Math.floor(this.windows.size / maxRow);
        return {
            x: x + row * itemWidth,
            y: y + col * itemHeight,
            width: itemWidth,
            height: itemHeight,
        }
    },
    register(name: string, win: BrowserWindow | BrowserView) {
        if (!isDev || !DevToolsManager.enable) {
            return
        }
        this.getOrCreateWindow(name, win);
    },
    autoShow(win: BrowserWindow | BrowserView) {
        if (!isDev || !DevToolsManager.enable) {
            return
        }
        if (WindowConfig.alwaysOpenDevTools) {
            win.webContents.openDevTools({
                mode: 'detach',
                activate: false,
            })
        }
    }
}
