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
    onMaximize: (cb: Function) => {
        window['__page'].hooks.onMaximize = cb
    },
    onUnmaximize: (cb: Function) => {
        window['__page'].hooks.onUnmaximize = cb
    },
    onEnterFullScreen: (cb: Function) => {
        window['__page'].hooks.onEnterFullScreen = cb
    },
    onLeaveFullScreen: (cb: Function) => {
        window['__page'].hooks.onLeaveFullScreen = cb
    },
    onShowQuitConfirmDialog: (cb: Function) => {
        window['__page'].hooks.onShowQuitConfirmDialog = cb
    },
    broadcastListeners: {},
    onBroadcast: (type: string, cb: (data: any) => void) => {
        if (!(type in window['__page'].broadcastListeners)) {
            window['__page'].broadcastListeners[type] = []
        }
        window['__page'].broadcastListeners[type].push(cb)
    },
    offBroadcast: (type: string, cb: (data: any) => void) => {
        if (!(type in window['__page'].broadcastListeners)) {
            return
        }
        window['__page'].broadcastListeners[type] = window['__page'].broadcastListeners[type].filter(c => c !== cb)
    },
    callPage: {},
    registerCallPage: (
        name: string,
        cb: (
            resolve: (data: any) => void,
            reject: (error: string) => void,
            data: any
        ) => void
    ) => {
        window['__page'].callPage[name] = cb
    },
    channel: {},
    createChannel: (cb: (data: any) => void) => {
        const channel = Math.random().toString(36).substring(2)
        window['__page'].channel[channel] = cb
        return channel
    },
    destroyChannel: (channel: string) => {
        delete window['__page'].channel[channel]
    },
}

ipcRenderer.removeAllListeners('MAIN_PROCESS_MESSAGE')
ipcRenderer.on('MAIN_PROCESS_MESSAGE', (_event: any, payload: any) => {
    if ('APP_READY' === payload.type) {
        MAPI.init(payload.data.AppEnv)
    } else if ('CALL_PAGE' === payload.type) {
        let {type, data, option} = payload.data
        option = Object.assign({
            waitReadyTimeout: 10 * 1000,
        }, option)
        // console.log('CALL_PAGE', type, {type, data, option})
        const resultEventName = `event:callPage:${payload.id}`
        const send = (code: number, msg: string, data?: any) => {
            ipcRenderer.send(resultEventName, {code, msg, data})
        }
        if (!window['__page'].callPage) {
            send(-1, 'error')
            return
        }
        const callPageExecute = () => {
            window['__page'].callPage[type](
                (resultData: any) => send(0, 'ok', resultData),
                (error: string) => send(-1, error),
                data
            )
        }
        if (!window['__page'].callPage[type]) {
            if (option.waitReadyTimeout > 0) {
                const start = Date.now()
                const monitor = () => {
                    setTimeout(() => {
                        if (!window['__page'].callPage[type]) {
                            if (Date.now() - start > option.waitReadyTimeout) {
                                send(-1, 'timeout')
                                return
                            } else {
                                monitor()
                                return
                            }
                        } else {
                            callPageExecute()
                        }
                    }, 10)
                }
                monitor()
                return
            }
            send(-1, 'event not found')
            return
        }
        callPageExecute()
    } else if ('CHANNEL' === payload.type) {
        const {channel, data} = payload.data
        if (!window['__page'].channel || !window['__page'].channel[channel]) {
            return
        }
        window['__page'].channel[channel](data)
    } else if ('BROADCAST' === payload.type) {
        const {type, data} = payload.data
        if (window['__page'].broadcastListeners[type]) {
            window['__page'].broadcastListeners[type].forEach((cb: Function) => {
                cb(data)
            })
        }
    } else {
        console.warn('UnknownMainProcessMessage', JSON.stringify(payload))
    }
})


