import url, {fileURLToPath} from "node:url";
import {BrowserWindow} from "electron";
import {isPackaged} from "./path";
import path, {join} from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '../..')

export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')
export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
    ? path.join(process.env.APP_ROOT, 'public')
    : RENDERER_DIST

export const preloadDefault = path.join(MAIN_DIST, 'preload/index.mjs')

export const rendererPath = (window: BrowserWindow, fileName: string) => {
    if (!isPackaged && process.env.VITE_DEV_SERVER_URL) {
        const x = new url.URL(rendererDistPath(fileName));
        window.loadURL(x.toString());
    } else {
        window.loadFile(rendererDistPath(fileName));
    }
    window.webContents.on("will-navigate", (event) => {
        event.preventDefault();
    });
    window.webContents.setWindowOpenHandler(() => {
        return {action: "deny"};
    });
}

function rendererDistPath(fileName: string) {
    if (!isPackaged && process.env.VITE_DEV_SERVER_URL) {
        return `${process.env.VITE_DEV_SERVER_URL}/${fileName}`;
    }
    return join(RENDERER_DIST, fileName);
}
