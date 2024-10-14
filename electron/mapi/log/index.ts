import electron from "electron";
import date from "date-and-time";
import path from "node:path";
import {AppEnv} from "../env";
import fs from "node:fs";

let fileName = null
let fileStream = null

const stringDatetime = () => {
    return date.format(new Date(), 'YYYYMMDD')
}
const logsDir = () => {
    return path.join(AppEnv.userData, 'logs')
}

const appLogsDir = () => {
    return path.join(AppEnv.userData, 'data/logs')
}

const root = () => {
    return logsDir()
}

const file = () => {
    return path.join(logsDir(), 'log_' + stringDatetime() + '.log')
}

const cleanOldLogs = (keepDays: number) => {
    const logDirs = [
        // 系统日志
        logsDir(),
        // 应用日志
        appLogsDir()
    ]
    for (const logDir of logDirs) {
        if (!fs.existsSync(logDir)) {
            return
        }
        const files = fs.readdirSync(logDir)
        const now = new Date()
        // console.log('cleanOldLogs', logDir, files)
        for (let file of files) {
            const filePath = path.join(logDir, file)
            let date = null
            for (let s of file.split('_')) {
                // 匹配 YYYYMMDD
                if (s.match(/^\d{8}$/)) {
                    date = s
                    break
                }
            }
            if (!date) {
                continue
            }
            const fileDate = new Date(
                parseInt(date.substring(0, 4)),
                parseInt(date.substring(4, 6)) - 1,
                parseInt(date.substring(6, 8))
            )
            const diff = Math.abs(now.getTime() - fileDate.getTime())
            const diffDays = Math.ceil(diff / (1000 * 3600 * 24))
            // console.log('fileDate', file, fileDate, diffDays)
            if (diffDays > keepDays) {
                fs.unlinkSync(filePath)
            }
        }
    }
}

const log = (level: 'INFO' | 'ERROR', label: string, data: any = null) => {
    if (fileName !== file()) {
        fileName = file()
        const logDir = logsDir()
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir)
        }
        if (fileStream) {
            fileStream.end()
        }
        fileStream = fs.createWriteStream(fileName, {flags: 'a'})
        cleanOldLogs(14)
    }
    let line = []
    line.push(date.format(new Date(), 'YYYY-MM-DD HH:mm:ss'))
    line.push(level)
    line.push(label)
    if (data) {
        if (!['number', 'string'].includes(typeof data)) {
            data = JSON.stringify(data)
        }
        line.push(data)
    }
    console.log(line.join(' - '))
    fileStream.write(line.join(' - ') + "\n")
}

const info = (label: string, data: any = null) => {
    return log('INFO', label, data)
}
const error = (label: string, data: any = null) => {
    return log('ERROR', label, data)
}

const infoRenderOrMain = (label: string, data: any = null) => {
    if (electron.ipcRenderer) {
        return electron.ipcRenderer.invoke('log:info', label, data)
    } else {
        return info(label, data)
    }
}
const errorRenderOrMain = (label: string, data: any = null) => {
    if (electron.ipcRenderer) {
        return electron.ipcRenderer.invoke('log:error', label, data)
    } else {
        return error(label, data)
    }
}


export default {
    root,
    info,
    error,
    infoRenderOrMain,
    errorRenderOrMain,
}

export const Log = {
    info: infoRenderOrMain,
    error: errorRenderOrMain,
}
