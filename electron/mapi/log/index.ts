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

const file = () => {
    return path.join(logsDir(), 'log_' + stringDatetime() + '.log')
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
    info,
    error,
    infoRenderOrMain,
    errorRenderOrMain,
}

export const Log = {
    info: infoRenderOrMain,
    error: errorRenderOrMain,
}
