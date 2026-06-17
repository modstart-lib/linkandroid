import dayjs from 'dayjs'
import {Base64} from 'js-base64'
import {t} from '../lang'

export const sleep = (time = 1000) => {
    return new Promise((resolve) => {
        setTimeout(() => resolve(true), time)
    })
}

export const wait = (callback: () => boolean | Promise<boolean>, interval = 10, timeout = 3600) => {
    const startTime = Date.now()
    return new Promise((resolve) => {
        const timer = setInterval(async () => {
            if (Date.now() - startTime > timeout * 1000) {
                clearInterval(timer)
                resolve(false)
                return
            }
            let res = callback()
            if (res instanceof Promise) {
                res = await res
            }
            if (res) {
                clearInterval(timer)
                resolve(true)
            }
        }, interval)
    })
}

/**
 * 精确计时器
 * @param callback
 * @param interval
 * @returns
 */
export function preciseInterval(callback: () => void, interval: number) {
    let expected = performance.now() + interval
    let stop = false

    function step(timestamp: number) {
        if (stop) return
        if (timestamp >= expected) {
            callback()
            // 累积期望的时间，以保持精确的间隔
            expected += interval
        }
        requestAnimationFrame(step)
    }

    requestAnimationFrame(step)
    // 返回一个对象包含取消方法
    return {
        cancel: () => {
            stop = true
        },
    }
}

export const StringUtil = {
    random(length: number = 16) {
        const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
        let result = ''
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length))
        }
        return result
    },
    uuid: () => {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = (Math.random() * 16) | 0
            const v = c === 'x' ? r : (r & 0x3) | 0x8
            return v.toString(16)
        })
    },
    replaceParam: (str: string, param: Record<string, string>) => {
        return str.replace(/{(.*?)}/g, (match: string, key: string) => {
            return param[key] || match
        })
    },
}

export const TimeUtil = {
    timestamp() {
        return Math.floor(Date.now() / 1000)
    },
    datetimeToTimestamp(datetime: string) {
        return dayjs(datetime).unix()
    },
    timestampMS() {
        return Date.now()
    },
    format(time: number, format: string = 'YYYY-MM-DD HH:mm:ss') {
        return dayjs(time).format(format)
    },
    formatDate(time: number) {
        return dayjs(time).format('YYYY-MM-DD')
    },
    dateString() {
        return dayjs().format('YYYYMMDD')
    },
    datetimeString() {
        return dayjs().format('YYYYMMDD_HHmmss')
    },
    secondsToTime(seconds: number, showMs: boolean = false) {
        const sec = Math.floor(seconds)
        const ms = Math.floor((seconds - sec) * 1000)
        const h = Math.floor(sec / 3600)
        const m = Math.floor((sec % 3600) / 60)
        const s = Math.floor(sec % 60)
        const hStr = String(h).padStart(2, '0')
        const mStr = String(m).padStart(2, '0')
        const sStr = String(s).padStart(2, '0')
        const result = '00' === hStr ? `${mStr}:${sStr}` : `${hStr}:${mStr}:${sStr}`
        if (showMs) {
            const fStr = String(ms).padStart(3, '0')
            return `${result}.${fStr}`
        }
        return result
    },
    msToTime(ms: number) {
        return this.secondsToTime(ms / 1000, true)
    },
    secondsToHuman(seconds: number) {
        const secs = Math.floor(seconds)
        const h = Math.floor(secs / 3600)
        const m = Math.floor((secs % 3600) / 60)
        const s = Math.floor(secs % 60)
        const result: string[] = []
        if (h > 0) result.push(`${h}${t('time.hour')}`)
        if (m > 0) result.push(`${m}${t('time.minute')}`)
        if (s > 0) result.push(`${s}${t('time.second')}`)
        return result.join('')
    },
    replacePattern(text: string) {
        return text
            .replaceAll('{year}', dayjs().format('YYYY'))
            .replaceAll('{month}', dayjs().format('MM'))
            .replaceAll('{day}', dayjs().format('DD'))
            .replaceAll('{hour}', dayjs().format('HH'))
            .replaceAll('{minute}', dayjs().format('mm'))
            .replaceAll('{second}', dayjs().format('ss'))
    },
}

export const EncodeUtil = {
    base64Encode(str: string) {
        return Base64.encode(str)
    },
    base64Decode(str: string) {
        return Base64.decode(str)
    },
}

export const VersionUtil = {
    /**
     * 检测版本是否匹配
     * @param v string
     * @param match string 如 * 或 >=1.0.0 或 >1.0.0 或 <1.0.0 或 <=1.0.0 或 1.0.0
     */
    match(v: string, match: string) {
        if (match === '*') {
            return true
        }
        if (match.startsWith('>=') && this.ge(v, match.substring(2))) {
            return true
        }
        if (match.startsWith('>') && this.gt(v, match.substring(1))) {
            return true
        }
        if (match.startsWith('<=') && this.le(v, match.substring(2))) {
            return true
        }
        if (match.startsWith('<') && this.lt(v, match.substring(1))) {
            return true
        }
        return this.eq(v, match)
    },
    compare(v1: string, v2: string) {
        const v1Arr = v1.split('.')
        const v2Arr = v2.split('.')
        for (let i = 0; i < v1Arr.length; i++) {
            const v1Num = parseInt(v1Arr[i])
            const v2Num = parseInt(v2Arr[i])
            if (v1Num > v2Num) {
                return 1
            } else if (v1Num < v2Num) {
                return -1
            }
        }
        return 0
    },
    gt(v1: string, v2: string) {
        return VersionUtil.compare(v1, v2) > 0
    },
    ge(v1: string, v2: string) {
        return VersionUtil.compare(v1, v2) >= 0
    },
    lt(v1: string, v2: string) {
        return VersionUtil.compare(v1, v2) < 0
    },
    le: (v1: string, v2: string) => {
        return VersionUtil.compare(v1, v2) <= 0
    },
    eq: (v1: string, v2: string) => {
        return VersionUtil.compare(v1, v2) === 0
    },
}

export const BrowserUtil = {
    isMac() {
        return navigator.platform.toUpperCase().indexOf('MAC') >= 0
    },
    isWindows() {
        return navigator.platform.toUpperCase().indexOf('WIN') >= 0
    },
    isLinux() {
        return navigator.platform.toUpperCase().indexOf('LINUX') >= 0
    },
}

export const ShellUtil = {
    quotaPath(p: string) {
        return `"${p}"`
    },
}

export const ObjectUtil = {
    clone(obj: any) {
        return JSON.parse(JSON.stringify(obj))
    },
}

/**
 * 递归截断对象中所有 base64 图片数据，保留头尾避免日志过大
 * @param value 任意值
 * @param maxLen 截断后保留的最大长度（默认120字符）
 * @param keepHead 保留头部字符数
 * @param keepTail 保留尾部字符数
 */
export const truncateBase64InObject = (
    value: any,
    maxLen: number = 120,
    keepHead: number = 40,
    keepTail: number = 20,
): any => {
    if (typeof value === 'string') {
        // 匹配 data:image/xxx;base64,... 格式
        if (value.length > maxLen) {
            const base64Match = value.match(/^data:image\/(\w+);base64,/)
            if (base64Match) {
                const prefix = value.substring(0, base64Match[0].length + keepHead)
                const suffix = value.substring(value.length - keepTail)
                return `${prefix}...(length=${value.length})${suffix}`
            }
            // 纯 base64 字符长串
            if (/^[A-Za-z0-9+/=]+$/.test(value.substring(0, 100))) {
                return (
                    value.substring(0, keepHead) +
                    `...(length=${value.length})` +
                    value.substring(value.length - keepTail)
                )
            }
        }
        return value
    }
    if (Array.isArray(value)) {
        return value.map((v) => truncateBase64InObject(v, maxLen, keepHead, keepTail))
    }
    if (value && typeof value === 'object') {
        const result: Record<string, any> = {}
        for (const key in value) {
            if (Object.prototype.hasOwnProperty.call(value, key)) {
                result[key] = truncateBase64InObject(value[key], maxLen, keepHead, keepTail)
            }
        }
        return result
    }
    return value
}

/**
 * 记录 AI 对话的完整请求/响应日志，方便问题排查
 * 自动截断 base64 图片数据、脱敏 API Key
 */
export const logAiChat = (
    type: 'request' | 'response' | 'error',
    data: {
        url?: string
        headers?: Record<string, string>
        body?: any
        status?: number
        statusText?: string
        duration?: number
        requestId?: string
        error?: any
    },
) => {
    const label = `[AI-Chat:${type}]`
    const logData: Record<string, any> = {
        requestId: data.requestId || '',
        ts: Date.now(),
    }
    if (data.url) logData.url = data.url
    if (data.headers) {
        logData.headers = {...data.headers}
        // 脱敏 API Key
        if (logData.headers.authorization) {
            const auth = logData.headers.authorization
            if (auth.startsWith('Bearer ')) {
                const key = auth.substring(7)
                logData.headers.authorization = `Bearer ${key.substring(0, 8)}...${key.substring(key.length - 4)}`
            }
        }
        if (logData.headers['Authorization']) {
            const auth = logData.headers['Authorization']
            if (auth.startsWith('Bearer ')) {
                const key = auth.substring(7)
                logData.headers['Authorization'] = `Bearer ${key.substring(0, 8)}...${key.substring(key.length - 4)}`
            }
        }
    }
    if (data.body) {
        logData.body = truncateBase64InObject(data.body)
    }
    if (data.status !== undefined) logData.status = data.status
    if (data.statusText) logData.statusText = data.statusText
    if (data.duration !== undefined) logData.duration = data.duration
    if (data.error) logData.error = data.error

    const mapi = typeof window !== 'undefined' ? (window as any).$mapi : undefined
    if (mapi?.log) {
        if (type === 'error') {
            mapi.log.error(label, logData)
        } else {
            mapi.log.info(label, logData)
        }
    } else {
        // fallback to console when $mapi is not available (e.g., test environment)
        if (type === 'error') {
            console.error(label, JSON.stringify(logData, null, 2))
        } else {
            console.log(label, JSON.stringify(logData, null, 2))
        }
    }
}

export const DownloadUtil = {
    downloadFile(content: string, filename?: string) {
        const blob = new Blob([content], {type: 'application/octet-stream'})
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename || `download_${TimeUtil.datetimeString()}.txt`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    },
}
