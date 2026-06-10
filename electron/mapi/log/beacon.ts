/**
 * 主进程异常上报（HTTP Beacon）
 * 仅在 isPackaged（非开发）模式下上报，批量异步发送。
 */
import https from 'node:https'
import {isPackaged, platformUUID} from '../../lib/env'
import {AppConfig} from '../../../src/config'

declare const __BUILD_ID__: string

const BEACON_URL = 'https://g.tecmz.com/grow/load.gif'
const BEACON_APP = 'linkandroid'
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
    props: {msg: string; stack?: string}
}

let pending: BeaconEvent[] = []
let timer: ReturnType<typeof setTimeout> | null = null
let _did: string | null = null

const getDid = (): string => {
    if (_did) return _did
    try {
        _did = platformUUID() || 'unknown'
    } catch {
        _did = 'unknown'
    }
    return _did
}

const flush = () => {
    if (!pending.length) return
    const events = pending.splice(0)
    try {
        const encoded = encodeURIComponent(Buffer.from(JSON.stringify(events)).toString('base64'))
        const url = `${BEACON_URL}?app=${BEACON_APP}&data=${encoded}`
        https.get(url).on('error', () => {})
    } catch {}
}

const schedule = () => {
    if (timer) return
    timer = setTimeout(() => {
        timer = null
        flush()
    }, 3000)
}

export const reportError = (msg: string, stack?: string, path = '/main') => {
    if (!isPackaged) return
    pending.push({
        et: 'error',
        path,
        did: getDid(),
        sid: sessionId,
        ts: Date.now(),
        type: `app-${AppConfig.version}`,
        bid: buildId,
        props: {msg, stack},
    })
    schedule()
}
