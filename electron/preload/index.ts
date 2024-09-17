import {contextBridge, ipcRenderer} from 'electron'
import {MAPI} from "../mapi/render";

process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true'

MAPI.init()
ipcRenderer.on('MAIN_PROCESS_MESSAGE', (_event: any, payload: any) => {
    switch (payload.type) {
        case 'APP_READY':
            MAPI.init(payload.data)
            break
        default:
            console.warn('Unknown message from main process:', payload)
            break
    }
})

