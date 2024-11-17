import {BrowserWindow, screen} from "electron";
import {isDev} from "./env";

export const DevToolsManager = {
    windowWidth: 600,
    windowHeight: 600,
    windows: new Map<BrowserWindow, BrowserWindow>(),
    getOrCreateWindow(name: string, win: BrowserWindow) {
        if (this.windows.has(win)) {
            return this.windows.get(win);
        }
        const {x, y} = this.getDisplayPosition()
        const devtools = new BrowserWindow({
            show: true,
            x,
            y,
            width: this.windowWidth,
            height: this.windowHeight,
            title: name,
        });
        win.webContents.setDevToolsWebContents(devtools.webContents);
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
        x: number, y: number
    } {
        const display = this.getLargestDisplay()
        const {x, y, width, height} = display.workArea;
        const maxRow = Math.floor(width / this.windowWidth);
        const row = this.windows.size % maxRow;
        const col = Math.floor(this.windows.size / maxRow);
        return {
            x: x + row * this.windowWidth,
            y: y + col * this.windowHeight,
        }
    },
    register(name: string, win: BrowserWindow) {
        if (!isDev) {
            return
        }
        this.getOrCreateWindow(name, win);
    }
}
