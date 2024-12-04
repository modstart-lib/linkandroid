import {Base64} from "js-base64";
import * as crypto from "node:crypto";
import dayjs from "dayjs";
import fs from "node:fs";

export const EncodeUtil = {
    base64Encode(str: string) {
        return Base64.encode(str)
    },
    base64Decode(str: string) {
        return Base64.decode(str)
    },
    md5(str: string) {
        return crypto.createHash('md5').update(str).digest('hex')
    }
}

export const StrUtil = {
    randomString(len: number = 32) {
        const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
        let result = ''
        for (let i = len; i > 0; --i) {
            result += chars[Math.floor(Math.random() * chars.length)]
        }
        return result
    },
    uuid() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = Math.random() * 16 | 0
            const v = c === 'x' ? r : (r & 0x3 | 0x8)
            return v.toString(16)
        })
    },
    hashCode(str: string, length: number = 8) {
        let hash = 0
        if (str.length === 0) return hash + ''
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i)
            hash = ((hash << 5) - hash) + char
            hash = hash & hash
        }
        let result = Math.abs(hash).toString(16)
        if (result.length < length) {
            result = '0'.repeat(length - result.length) + result
        }
        return result
    },
    hashCodeWithDuplicateCheck(str: string, check: string[], length: number = 8) {
        let code = this.hashCode(str, length)
        while (check.includes(code)) {
            code = this.uuid().substring(0, length)
        }
        return code
    },
    bigIntegerId() {
        return [
            Date.now(),
            (Math.floor(Math.random() * 1000000) + '').padStart(6, '0')
        ].join('')
    }
}

export const TimeUtil = {
    timestampInMs() {
        return Date.now()
    },
    timestamp() {
        return Math.floor(Date.now() / 1000)
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
        return dayjs().format('YYYYMMDD_HHmmss_SSS')
    },
    timestampDayStart() {
        const date = new Date()
        date.setHours(0, 0, 0, 0)
        return Math.floor(date.getTime() / 1000)
    },
}


export const FileUtil = {
    streamToBase64(stream: NodeJS.ReadableStream): Promise<string> {
        return new Promise((resolve, reject) => {
            const chunks = []
            stream.on('data', (chunk) => {
                chunks.push(chunk)
            })
            stream.on('end', () => {
                const buffer = Buffer.concat(chunks)
                resolve(buffer.toString('base64'))
            })
            stream.on('error', (error) => {
                reject(error)
            })
        })
    },
    bufferToBase64(buffer: Buffer) {
        let binary = '';
        let bytes = new Uint8Array(buffer);
        let len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return EncodeUtil.base64Encode(binary)
    },
    base64ToBuffer(base64: string): Buffer {
        if (base64.startsWith('data:')) {
            base64 = base64.split('base64,')[1]
        }
        return Buffer.from(base64, 'base64')
    },
    formatSize(size: number) {
        if (size < 1024) {
            return size + 'B'
        } else if (size < 1024 * 1024) {
            return (size / 1024).toFixed(2) + 'KB'
        } else if (size < 1024 * 1024 * 1024) {
            return (size / 1024 / 1024).toFixed(2) + 'MB'
        } else {
            return (size / 1024 / 1024 / 1024).toFixed(2) + 'GB'
        }
    },
    async md5(filePath: string) {
        return new Promise((resolve, reject) => {
            const hash = crypto.createHash('md5')
            const stream = fs.createReadStream(filePath)
            stream.on('data', (data) => {
                hash.update(data)
            })
            stream.on('end', () => {
                resolve(hash.digest('hex'))
            })
            stream.on('error', (error) => {
                reject(error)
            })
        })
    }
}

export const JsonUtil = {
    stringifyOrdered(obj: any) {
        return JSON.stringify(obj, Object.keys(obj).sort(), 4)
    },
    stringifyValueOrdered(obj: any) {
        const sortedData = Object.fromEntries(
            Object.entries(obj).sort(([, a], [, b]) => {
                // @ts-ignore
                return a as any - b as any
            })
        );
        return JSON.stringify(sortedData, null, 4)
    }
}

export const ImportUtil = {
    async loadCommonJs(cjsPath: string) {
        const md5 = await FileUtil.md5(cjsPath)
        const backend = await import(/* @vite-ignore */ `${cjsPath}?t=${md5}`)
        // console.log('loadCommonJs', `${cjsPath}?t=${md5}`)
        return backend.default
    }
}

export const MemoryCacheUtil = {
    pool: {} as {
        [key: string]: {
            value: any,
            expire: number,
        }
    },
    _gc() {
        const now = TimeUtil.timestamp()
        for (const key in this.pool) {
            if (this.pool[key].expire < now) {
                delete this.pool[key]
            }
        }
    },
    async remember(key: string, callback: () => Promise<any>, ttl: number = 60) {
        if (this.pool[key] && this.pool[key].expire > TimeUtil.timestamp()) {
            return this.pool[key].value
        }
        const value = await callback()
        this.pool[key] = {
            value,
            expire: TimeUtil.timestamp() + ttl,
        }
        this._gc()
        return value
    },
    get(key: string) {
        if (this.pool[key] && this.pool[key].expire > TimeUtil.timestamp()) {
            return this.pool[key].value
        }
        this._gc()
        return null
    },
    set(key: string, value: any, ttl: number = 60) {
        this.pool[key] = {
            value,
            expire: TimeUtil.timestamp() + ttl,
        }
        this._gc()
    },
    forget(key: string) {
        delete this.pool[key]
    }
}


export const ShellUtil = {
    quotaPath(p: string) {
        return `"${p}"`
    }
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
    }
}


export const UIUtil = {
    sizeToPx(size: string, sizeFull: number) {
        if (/^\d+$/.test(size)) {
            // 纯数字
            return parseInt(size)
        } else if (size.endsWith('%')) {
            // 百分比
            let result = Math.floor((sizeFull * parseInt(size) / 100))
            result = Math.min(result, sizeFull)
            return result
        } else {
            throw 'UnsupportSizeString'
        }
    }
}
