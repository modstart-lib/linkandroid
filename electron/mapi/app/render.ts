import {ipcRenderer} from "electron";
import {resolve} from "node:path";
import {isPackaged, platformName, platformArch} from "../../lib/env";
import {AppEnv, waitAppEnvReady} from "../env";
import appIndex from "./index";

const isDarkMode = async () => {
    return ipcRenderer.invoke('app:isDarkMode')
}

const quit = () => {
    return ipcRenderer.invoke('app:quit')
}

const restart = () => {
    return ipcRenderer.invoke('app:restart')
}

const isPlatform = (name: 'win' | 'osx' | 'linux') => {
    return platformName() === name
}

const windowMin = (name?: string) => {
    return ipcRenderer.invoke('window:min', name)
}

const windowMax = (name?: string) => {
    return ipcRenderer.invoke('window:max', name)
}

const windowSetSize = (name: string | null, width: number, height: number, option?: {
    includeMinimumSize: boolean,
    center: boolean
}) => {
    return ipcRenderer.invoke('window:setSize', name, width, height, option)
}

const windowOpen = (name: string, option: any) => {
    return ipcRenderer.invoke('window:open', name, option)
}

const windowHide = (name: string) => {
    return ipcRenderer.invoke('window:hide', name)
}

const windowClose = (name: string) => {
    return ipcRenderer.invoke('window:close', name)
}

const windowMove = (name: string | null, data: { mouseX: number, mouseY: number, width: number, height: number }) => {
    return ipcRenderer.invoke('window:move', name, data)
}

const openExternalWeb = (url: string) => {
    return ipcRenderer.invoke('app:openExternalWeb', url)
}

const getPreload = async () => {
    return ipcRenderer.invoke('app:getPreload')
}

const resourcePathResolve = async (filePath: string) => {
    await waitAppEnvReady()
    const basePath = isPackaged ? process.resourcesPath : AppEnv.appRoot
    return resolve(basePath, filePath)
}

const extraPathResolve = async (filePath: string) => {
    await waitAppEnvReady()
    const basePath = isPackaged ? process.resourcesPath : 'electron/resources'
    return resolve(basePath, 'extra', filePath)
}

const appEnv = async () => {
    await waitAppEnvReady()
    return AppEnv
}

const getClipboardText = () => {
    return ipcRenderer.invoke('app:getClipboardText')
}

const setClipboardText = (text: string) => {
    return ipcRenderer.invoke('app:setClipboardText', text)
}

const getClipboardImage = () => {
    return ipcRenderer.invoke('app:getClipboardImage')
}

const setClipboardImage = (image: string) => {
    return ipcRenderer.invoke('app:setClipboardImage', image)
}

const toast = (msg: string, option?: any) => {
    return ipcRenderer.invoke('app:toast', msg, option)
}

const setupList = () => {
    return ipcRenderer.invoke('app:setupList')
}

const setupOpen = (name: string) => {
    return ipcRenderer.invoke('app:setupOpen', name)
}

const setupIsOk = async () => {
    return ipcRenderer.invoke('app:setupIsOk')
}

export const AppsRender = {
    isDarkMode,
    resourcePathResolve,
    extraPathResolve,
    platformName,
    platformArch,
    isPlatform,
    quit,
    restart,
    windowMin,
    windowMax,
    windowSetSize,
    windowOpen,
    windowHide,
    windowClose,
    windowMove,
    openExternalWeb,
    getPreload,
    appEnv,
    getClipboardText,
    setClipboardText,
    getClipboardImage,
    setClipboardImage,
    toast,
    setupList,
    setupOpen,
    setupIsOk,
    shell: appIndex.shell,
    spawnShell: appIndex.spawnShell,
    availablePort: appIndex.availablePort,
    fixExecutable: appIndex.fixExecutable,
    getUserAgent: appIndex.getUserAgent,
}

export default AppsRender

