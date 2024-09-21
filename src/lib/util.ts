import {Base64} from 'js-base64';
import dayjs from "dayjs";

export const sleep = (time = 1000) => {
    return new Promise((resolve) => {
        setTimeout(() => resolve(true), time)
    })
}

export const StringUtil = {
    random(length: number = 16) {
        const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        let result = "";
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result
    },
    uuid: () => {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = Math.random() * 16 | 0
            const v = c === 'x' ? r : (r & 0x3 | 0x8)
            return v.toString(16)
        })
    }
}

export const TimeUtil = {
    timestampMS() {
        return new Date().getTime()
    },
    format(time: number, format: string = 'YYYY-MM-DD HH:mm:ss') {
        return dayjs(time).format(format)
    },
    formatDate(time: number) {
        return dayjs(time).format('YYYY-MM-DD')
    },
    secondsToTime(seconds: number) {
        let h: any = Math.floor(seconds / 3600)
        let m: any = Math.floor(seconds % 3600 / 60)
        let s: any = Math.floor(seconds % 60)
        if (h < 10) h = '0' + h
        if (m < 10) m = '0' + m
        if (s < 10) s = '0' + s
        return `${h}:${m}:${s}`
    }
}

export const EncodeUtil = {
    base64Encode(str: string) {
        return Base64.encode(str)
    },
    base64Decode(str: string) {
        return Base64.decode(str)
    }
}

export const VersionUtil = {
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
    }
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
    }
}

export const ShellUtil = {
    quotaPath(p: string) {
        return `"${p}"`
    }
}
