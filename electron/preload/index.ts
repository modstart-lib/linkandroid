import {ipcRenderer} from 'electron'
import {MAPI} from "../mapi/render";

process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true'

MAPI.init()

window['__page'] = {
    hooks: {},
    onShow: (cb: Function) => {
        window['__page'].hooks.onShow = cb
    },
    onHide: (cb: Function) => {
        window['__page'].hooks.onHide = cb
    },
    broadcastListeners: {},
    onBroadcast: (type: string, cb: Function) => {
        if (!(type in window['__page'].broadcastListeners)) {
            window['__page'].broadcastListeners[type] = []
        }
        window['__page'].broadcastListeners[type].push(cb)
    },
    offBroadcast: (type: string, cb: Function) => {
        if (!(type in window['__page'].broadcastListeners)) {
            return
        }
        window['__page'].broadcastListeners[type] = window['__page'].broadcastListeners[type].filter(c => c !== cb)
    }
}

window['__callPage'] = {}

ipcRenderer.on('MAIN_PROCESS_MESSAGE', (_event: any, payload: any) => {
    if ('APP_READY' === payload.type) {
        MAPI.init(payload.data.AppEnv)
        window['__thirdParty'] = window['__thirdParty'] || {}
        window['__thirdParty'].name = payload.data.name
    } else if ('CALL_THIRD_PARTY' === payload.type) {
        const {type, data} = payload.data
        const resultEventName = `event:callThirdParty:${payload.id}`
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
    } else if ('CALL_PAGE' === payload.type) {
        const {type, data} = payload.data
        const resultEventName = `event:callPage:${payload.id}`
        const send = (code: number, msg: string, data?: any) => {
            ipcRenderer.send(resultEventName, {code, msg, data})
        }
        if (!window['__callPage']) {
            send(-1, 'error')
            return
        }
        if (!window['__callPage'][type]) {
            send(-1, 'event not found')
            return
        }
        window['__callPage'][type](data).then(
            (resultData: any) => send(0, 'ok', resultData),
            (error: string) => send(-1, error)
        )
    } else if ('CHANNEL' === payload.type) {
        // console.log('CHANNEL', payload)
        const {channel, data} = payload.data
        if (!window['__channel']) {
            return
        }
        if (!window['__channel'][channel]) {
            return
        }
        window['__channel'][channel](data)
    }else if ('BROADCAST'===payload.type){
        const {type, data} = payload.data
        if (window['__page'].broadcastListeners[type]) {
            window['__page'].broadcastListeners[type].forEach((cb: Function) => {
                cb(data)
            })
        }
    } else {
        console.warn('Unknown message from main process:', JSON.stringify(payload))
    }
})

