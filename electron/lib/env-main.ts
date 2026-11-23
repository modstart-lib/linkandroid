import url, {fileURLToPath} from 'node:url'
import {BrowserWindow} from 'electron'
import {isPackaged} from './env'
import path, {join} from 'node:path'
import {Log} from '../mapi/log/main'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '../..')

export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')
export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

export const preloadDefault = path.join(MAIN_DIST, 'preload/index.cjs')

export const rendererLoadPath = (window: BrowserWindow, fileName: string) => {
    if (!isPackaged && process.env.VITE_DEV_SERVER_URL) {
        window.loadURL(new url.URL(rendererDistPath(fileName)).toString())
    } else {
        window.loadFile(rendererDistPath(fileName))
    }
}

export const rendererDistPath = (fileName: string) => {
    if (!isPackaged && process.env.VITE_DEV_SERVER_URL) {
        return `${process.env.VITE_DEV_SERVER_URL.replace(/\/+$/, '')}/${fileName}`
    }
    return join(RENDERER_DIST, fileName)
}

export const rendererIsUrl = (url: string) => {
    return url.startsWith('http://') || url.startsWith('https://')
}

export const getGpuInfo = async () => {
    const list = [] as {
        index: number
        name: string
        size: number
    }[]
    try {
        // @ts-ignore
        const si = await import('systeminformation')
        const graphics = await si.graphics()
        graphics.controllers.forEach((controller, index) => {
            list.push({
                index,
                name: controller.model,
                size: Math.ceil(controller.vram / 1024),
            })
        })
    } catch (e) {
        Log.error('getGpuInfo', e)
    }
    return list
}
