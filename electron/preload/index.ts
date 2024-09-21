import {ipcRenderer} from 'electron'
import {MAPI} from "../mapi/render";

process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true'

MAPI.init()
ipcRenderer.on('MAIN_PROCESS_MESSAGE', (_event: any, payload: any) => {
    switch (payload.type) {
        case 'APP_READY':
            MAPI.init(payload.data.AppEnv)
            // @ts-ignore
            window['__thirdParty'] = window['__thirdParty'] || {}
            window['__thirdParty'].name = payload.data.name
            break
        case 'CUSTOM':
            const {type, data} = payload.data
            const resultEventName = `event:callCustom:${payload.id}`
            const send = (code: number, msg: string, data?: any) => {
                ipcRenderer.send(resultEventName, {code, msg, data})
            }
            if (!window['__thirdParty']) {
                send(-1, 'error')
                return
            }
            if (!window['__thirdParty']['events'] || !window['__thirdParty']['events'][type]) {
                send(-1, 'event not found')
                return
            }
            window['__thirdParty']['events'][type](
                (resultData: any) => send(0, 'ok', resultData),
                (error: string) => send(-1, error),
                data
            )
            break
        default:
            console.warn('Unknown message from main process:', JSON.stringify(payload))
            break
    }
})

