import {ipcRenderer} from 'electron'
import type {PyenvInfo} from './main'

const info = async (): Promise<PyenvInfo> => {
    return ipcRenderer.invoke('pyenv:info')
}

const install = async (
    packages: string[],
    option?: {indexUrl?: string},
): Promise<{ok: boolean; log: string; error?: string}> => {
    return ipcRenderer.invoke('pyenv:install', packages, option)
}

const uninstall = async (name: string): Promise<{ok: boolean; removed: number}> => {
    return ipcRenderer.invoke('pyenv:uninstall', name)
}

const clear = async (): Promise<{ok: boolean}> => {
    return ipcRenderer.invoke('pyenv:clear')
}

const check = async (requirements: string[]): Promise<string[]> => {
    return ipcRenderer.invoke('pyenv:check', requirements)
}

const openDir = async (): Promise<string> => {
    return ipcRenderer.invoke('pyenv:openDir')
}

const taskEnv = async (): Promise<Record<string, string>> => {
    return ipcRenderer.invoke('pyenv:taskEnv')
}

type InstallLog = {packages: string[]; line: string; done?: boolean; ok?: boolean}

const onInstallLog = (cb: (data: InstallLog) => void) => {
    window['__page'].onBroadcast('PyenvInstallLog', cb)
    return () => window['__page'].offBroadcast('PyenvInstallLog', cb)
}

export default {
    info,
    install,
    uninstall,
    clear,
    check,
    openDir,
    taskEnv,
    onInstallLog,
}
