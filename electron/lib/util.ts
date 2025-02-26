import {Base64} from "js-base64";
import * as crypto from "node:crypto";
import dayjs from "dayjs";
import fs from "node:fs";
import Showdown from "showdown"
import iconvLite from "iconv-lite";
import chardet from "chardet";
// import {Iconv} from "iconv"

export const EncodeUtil = {
    base64Encode(str: string) {
        return Base64.encode(str)
    },
    base64Decode(str: string) {
        return Base64.decode(str)
    },
    md5(str: string) {
        return crypto.createHash('md5').update(str).digest('hex')
    },
    aesEncode(str: string, key: string) {
        const cipher = crypto.createCipheriv('aes-128-ecb', key, '')
        let crypted = cipher.update(str, 'utf8', 'base64')
        crypted += cipher.final('base64')
        return crypted
    },
    aesDecode(str: string, key: string) {
        const decipher = crypto.createDecipheriv('aes-128-ecb', key, '')
        let dec = decipher.update(str, 'base64', 'utf8')
        dec += decipher.final('utf8')
        return dec
    },
}

export const IconvUtil = {
    convert(str: string, to?: string, from?: string) {
        if (!from) {
            from = chardet.detect(Buffer.from(str))
        }
        to = to || 'utf8'
        const buffer = iconvLite.encode(str, from);
        return iconvLite.decode(buffer, to)
    },
    bufferToUtf8(buffer: Buffer) {
        const encoding = chardet.detect(buffer)
        // if ('ISO-2022-CN' === encoding) {
        //     const iconvInstance = new Iconv('ISO-2022-CN', 'UTF-8//TRANSLIT//IGNORE');
        //     return iconvInstance.convert(buffer).toString()
        // }
        return iconvLite.decode(buffer, encoding).toString()
    },
    detect(buffer: Uint8Array) {
        // detect str encoding
        return chardet.detect(buffer)
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
    timestampDayStart(msTimestamp?: number) {
        let date = msTimestamp ? new Date(msTimestamp) : new Date()
        date.setHours(0, 0, 0, 0)
        return Math.floor(date.getTime() / 1000)
    },
    replacePattern(text: string) {
        // @ts-ignore
        return text.replaceAll('{year}', dayjs().format('YYYY'))
            .replaceAll('{month}', dayjs().format('MM'))
            .replaceAll('{day}', dayjs().format('DD'))
            .replaceAll('{hour}', dayjs().format('HH'))
            .replaceAll('{minute}', dayjs().format('mm'))
            .replaceAll('{second}', dayjs().format('ss'))
    }
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
        const backend = await import(/* @vite-ignore */ `file://${cjsPath}?t=${md5}`)
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
    set(key: string, value: any, ttl: number = 86400) {
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

export const MemoryMapCacheUtil = {
    pool: {} as {
        [group: string]: {
            [key: string]: {
                value: any,
                expire: number,
            }
        }
    },
    _gc() {
        const now = TimeUtil.timestamp()
        for (const group in this.pool) {
            for (const key in this.pool[group]) {
                if (this.pool[group][key].expire < now) {
                    delete this.pool[group][key]
                }
            }
        }
    },
    get(group: string, key: string) {
        if (this.pool[group] && this.pool[group][key] && this.pool[group][key].expire > TimeUtil.timestamp()) {
            return this.pool[group][key].value
        }
        this._gc()
        return null
    },
    set(group: string, key: string, value: any, ttl: number = 86400) {
        if (!this.pool[group]) {
            this.pool[group] = {}
        }
        this.pool[group][key] = {
            value,
            expire: TimeUtil.timestamp() + ttl,
        }
        this._gc()
    },
    forget(group: string, key: string) {
        if (this.pool[group]) {
            delete this.pool[group][key]
        }
    }
}

export const ShellUtil = {
    quotaPath(p: string) {
        return `"${p}"`
    },
    parseCommandArgs(command: string) {
        let args = []
        let arg = ''
        let quote = ''
        let escape = false
        for (let i = 0; i < command.length; i++) {
            const c = command[i]
            if (escape) {
                arg += c
                escape = false
                continue
            }
            if ('\\' === c) {
                escape = true
                arg += c
                continue
            }
            if ('' === quote && (' ' === c || '\t' === c)) {
                if (arg) {
                    args.push(arg)
                    arg = ''
                }
                continue
            }
            if ('' === quote && ('"' === c || "'" === c)) {
                quote = c
                arg += c
                continue
            }
            if ('"' === quote && '"' === c) {
                quote = ''
                arg += c
                continue
            }
            if ("'" === quote && "'" === c) {
                quote = ''
                arg += c
                continue
            }
            arg += c
        }
        if (arg) {
            args.push(arg)
        }
        return args
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
        if (match.startsWith('>=')) {
            if (this.ge(v, match.substring(2))) {
                return true
            }
        } else if (match.startsWith('<=')) {
            if (this.le(v, match.substring(2))) {
                return true
            }
        } else if (match.startsWith('>')) {
            if (this.gt(v, match.substring(1))) {
                return true
            }
        } else if (match.startsWith('<')) {
            if (this.lt(v, match.substring(1))) {
                return true
            }
        } else {
            return this.eq(v, match)
        }
        return false
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

export const ReUtil = {
    match(regex: string, text: string) {
        if ('' === regex || null === regex) {
            return false
        }
        if (regex.startsWith('/')) {
            const index = regex.lastIndexOf('/')
            const source = regex.slice(1, index)
            const flags = regex.slice(index + 1)
            return (new RegExp(source, flags)).test(text)
        }
        return (new RegExp(regex)).test(text)
    }
}

const converter = new Showdown.Converter({
    tables: true,
})
export const MarkdownUtil = {
    toHtml(markdown: string): string {
        return converter.makeHtml(markdown)
    },
}
