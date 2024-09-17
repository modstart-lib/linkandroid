import {Base64} from "js-base64";

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
    }
}

export const TimeUtil = {
    timestampInMs() {
        return Date.now()
    },
    timestamp() {
        return Math.floor(Date.now() / 1000)
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
