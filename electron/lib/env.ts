import {resolve} from "node:path";
import os from "os";
import {execSync} from "child_process";
import {Log} from "../mapi/log";

export const isPackaged = ['true'].includes(process.env.IS_PACKAGED)

export const isDev = !isPackaged

export const isWin = process.platform === 'win32'

export const isMac = process.platform === 'darwin'

export const isLinux = process.platform === 'linux'

export const isMain = process.type === 'browser'

export const isRender = process.type === 'renderer'

export const platformName = (): 'win' | 'osx' | 'linux' | null => {
    if (isWin) return 'win'
    if (isMac) return 'osx'
    if (isLinux) return 'linux'
    return null
}

export const memoryInfo = () => {
    return {
        total: os.totalmem(),
        free: os.freemem(),
    }
}


let platformVersionCache: string | null = null
export const platformVersion = () => {
    if (null === platformVersionCache) {
        if (isWin) {
            platformVersionCache = execSync('wmic os get Version').toString().split('\n')[1].trim()
        } else if (isMac) {
            platformVersionCache = execSync('sw_vers -productVersion').toString().trim()
        } else if (isLinux) {
            platformVersionCache = execSync('cat /etc/os-release | grep VERSION_ID').toString().split('=')[1].trim().replace(/"/g, '')
        } else {
            platformVersionCache = ''
        }
    }
    return platformVersionCache
}

export const platformArch = (): 'x86' | 'arm64' | null => {
    switch (os.arch()) {
        case 'x64':
            return 'x86'
        case 'arm64':
            return 'arm64'
    }
    return null
}

let platformUUIDCache: string | null = null
export const platformUUID = () => {
    if (null === platformUUIDCache) {
        try {
            if (isWin) {
                platformUUIDCache = execSync('wmic csproduct get UUID').toString().split('\n')[1].trim()
            } else if (isMac) {
                platformUUIDCache = execSync('system_profiler SPHardwareDataType | grep UUID').toString().split(': ')[1].trim()
            } else if (isLinux) {
                platformUUIDCache = execSync('cat /var/lib/dbus/machine-id').toString().trim().toUpperCase()
            }
        } catch (e) {
            Log.error('Env.platformUUID', e.message)
            platformUUIDCache = '000000'
        }
    }
    return platformUUIDCache
}

export const buildResolve = (value: string) => {
    return resolve(`electron/resources/build/${value}`)
}

export const binResolve = (value: string) => {
    return resolve(process.resourcesPath, 'bin', value)
}

export const extraResolve = (filePath: string) => {
    const basePath = isPackaged ? process.resourcesPath : 'electron/resources'
    return resolve(basePath, 'extra', filePath)
}

