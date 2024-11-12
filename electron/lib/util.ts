import {Base64} from "js-base64";
import dayjs from "dayjs";

// const {base64encode, base64decode} = require('nodejs-base64');

export const EncodeUtil = {
    base64Encode(str: string) {
        return Base64.encode(str)
    },
    base64Decode(str: string) {
        return Base64.decode(str)
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
        if (str.length === 0) return hash
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
        return dayjs().format('YYYYMMDD_HHmmss')
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
