/**
 * 渲染进程异常上报（HTTP Beacon）
 * 仅在 isPackaged（非开发）模式下上报，批量异步发送。
 */
import {AppConfig} from '../../../src/config'

declare const __BUILD_ID__: string

const BEACON_URL = 'https://g.tecmz.com/grow/load.gif'
const BEACON_APP = 'linkandroid'
const isPackaged = process.env['IS_PACKAGED'] === 'true'
const sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const buildId = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'unknown'

interface BeaconEvent {
    et: 'error'
    path: string
    did: string
    sid: string
    ts: number
    type: string
    bid: string
    props: {
        msg: string
        stack?: string
        src?: string
        line?: number
        col?: number
    }
}

let pending: BeaconEvent[] = []
let timer: ReturnType<typeof setTimeout> | null = null

const flush = () => {
    if (!pending.length) return
    const events = pending.splice(0)
    try {
        const encoded = encodeURIComponent(btoa(JSON.stringify(events)))
        const url = `${BEACON_URL}?app=${BEACON_APP}&data=${encoded}`
        fetch(url).catch(() => {})
    } catch {}
}

const schedule = () => {
    if (timer) return
    timer = setTimeout(() => {
        timer = null
        flush()
    }, 3000)
}

export const reportErrorRender = (
    msg: string,
    stack?: string,
    src?: string,
    line?: number,
    col?: number,
    path = '/renderer',
) => {
    if (!isPackaged) return
    pending.push({
        et: 'error',
        path,
        did: 'renderer',
        sid: sessionId,
        ts: Date.now(),
        type: `app-${AppConfig.version}`,
        bid: buildId,
        props: {msg, stack, src, line, col},
    })
    schedule()
}
