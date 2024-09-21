import {AppRuntime} from "../env";
import {ipcMain} from "electron";
import {StrUtil} from "../../lib/util";

const init = () => {

}

type NameType = 'main' | string
type EventType = 'APP_READY' | 'CUSTOM'

const send = (name: NameType, type: EventType, data: any = {}, id?: string): boolean => {
    id = id || StrUtil.randomString(32)
    const payload = {id, type, data}
    if (name === 'main') {
        if (!AppRuntime.mainWindow) {
            return false
        }
        AppRuntime.mainWindow?.webContents.send('MAIN_PROCESS_MESSAGE', payload)
    } else {
        if (!AppRuntime.windows[name]) {
            return false
        }
        AppRuntime.windows[name]?.webContents.send('MAIN_PROCESS_MESSAGE', payload)
    }
    return true
}

ipcMain.handle('event:send', async (_, name: NameType, type: EventType, data: any) => {
    send(name, type, data)
})

ipcMain.handle('event:callCustom', async (_, name: string, type: string, data: any, option: any) => {
    option = Object.assign({timeout: 10}, option)
    return new Promise((resolve, reject) => {
        const id = StrUtil.randomString(32)
        const timer = setTimeout(() => {
            ipcMain.removeListener(listenerKey, listener)
            resolve({code: -1, msg: 'timeout'})
        }, option.timeout * 1000)
        const listener = (_, result) => {
            clearTimeout(timer)
            resolve(result)
            return true
        }
        const listenerKey = 'event:callCustom:' + id
        ipcMain.once(listenerKey, listener)
        if (!send(name, 'CUSTOM', {type, data}, id)) {
            clearTimeout(timer)
            ipcMain.removeListener(listenerKey, listener)
            resolve({code: -1, msg: 'send failed'})
        }
    })
})

export default {
    init,
    send
}

export const Events = {
    send
}
