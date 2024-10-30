import path from "node:path";
import {AppEnv, waitAppEnvReady} from "../env";
import fs from "node:fs";
import {StrUtil, TimeUtil} from "../../lib/util";

const nodePath = path

const root = () => {
    return path.join(AppEnv.userData, 'data')
}

const absolutePath = (path: string) => {
    return `ABS://${path}`
}

const fullPath = async (path: string) => {
    await waitAppEnvReady()
    if (path.startsWith('ABS://')) {
        return path.replace(/^ABS:\/\//, '')
    }
    return nodePath.join(root(), path)
}

const exists = async (path: string, option?: { isFullPath: boolean, }) => {
    option = Object.assign({
        isFullPath: false,
    }, option)
    let fp = path
    if (!option.isFullPath) {
        fp = await fullPath(path)
    }
    return fs.existsSync(fp)
}

const isDirectory = async (path: string, option?: { isFullPath: boolean, }) => {
    option = Object.assign({
        isFullPath: false,
    }, option)
    let fp = path
    if (!option.isFullPath) {
        fp = await fullPath(path)
    }
    if (!fs.existsSync(fp)) {
        return false
    }
    return fs.statSync(fp).isDirectory()
}

const mkdir = async (path: string, option?: { isFullPath: boolean, }) => {
    option = Object.assign({
        isFullPath: false,
    }, option)
    let fp = path
    if (!option.isFullPath) {
        fp = await fullPath(path)
    }
    if (!fs.existsSync(fp)) {
        fs.mkdirSync(fp, {recursive: true})
    }
}

const list = async (path: string, option?: { isFullPath: boolean, }) => {
    option = Object.assign({
        isFullPath: false,
    }, option)
    let fp = path
    if (!option.isFullPath) {
        fp = await fullPath(path)
    }
    if (!fs.existsSync(fp)) {
        return []
    }
    const files = fs.readdirSync(fp)
    return files.map(file => {
        const stat = fs.statSync(nodePath.join(fp, file))
        let f = {
            name: file,
            isDirectory: stat.isDirectory(),
            size: stat.size,
            lastModified: stat.mtimeMs,
        }
        return f
    })
}

const listAll = async (path: string, option?: { isFullPath: boolean, }) => {
    option = Object.assign({
        isFullPath: false,
    }, option)
    let fp = path
    if (!option.isFullPath) {
        fp = await fullPath(path)
    }
    if (!fs.existsSync(fp)) {
        return []
    }
    const listDirectory = (path: string, basePath: string = '') => {
        let files = []
        const list = fs.readdirSync(path)
        for (let file of list) {
            const stat = fs.statSync(nodePath.join(path, file))
            let fPath = nodePath.join(basePath, file)
            fPath = fPath.replace(/\\/g, '/')
            let f = {
                name: file,
                path: fPath,
                isDirectory: stat.isDirectory(),
                size: stat.size,
                lastModified: stat.mtimeMs,
            }
            if (f.isDirectory) {
                files = files.concat(listDirectory(nodePath.join(path, file), f.path))
                continue
            }
            files.push(f)
        }
        return files
    }
    return listDirectory(fp)
}

const write = async (path: string, data: any, option?: { isFullPath: boolean, }) => {
    option = Object.assign({
        isFullPath: false,
    }, option)
    let fp = path
    if (!option.isFullPath) {
        fp = await fullPath(path)
    }
    const fullPathDir = nodePath.dirname(fp)
    if (!fs.existsSync(fullPathDir)) {
        fs.mkdirSync(fullPathDir, {recursive: true})
    }
    if (typeof data === 'string') {
        data = {
            content: data,
        }
    }
    const f = fs.openSync(fp, 'w')
    fs.writeSync(f, data.content)
    fs.closeSync(f)
}

const writeBuffer = async (path: string, data: any, option?: { isFullPath: boolean, }) => {
    option = Object.assign({
        isFullPath: false,
    }, option)
    let fp = path
    if (!option.isFullPath) {
        fp = await fullPath(path)
    }
    const fullPathDir = nodePath.dirname(fp)
    if (!fs.existsSync(fullPathDir)) {
        fs.mkdirSync(fullPathDir, {recursive: true})
    }
    const f = fs.openSync(fp, 'w')
    fs.writeSync(f, data)
    fs.closeSync(f)
}

const read = async (path: string, option?: { isFullPath: boolean, }) => {
    option = Object.assign({
        isFullPath: false,
    }, option)
    let fp = path
    if (!option.isFullPath) {
        fp = await fullPath(path)
    }
    if (!fs.existsSync(fp)) {
        return null
    }
    const f = fs.openSync(fp, 'r')
    const content = fs.readFileSync(f, 'utf8')
    fs.closeSync(f)
    return content
}

const readBuffer = async (path: string, option?: { isFullPath: boolean, }) => {
    option = Object.assign({
        isFullPath: false,
    }, option)
    let fp = path
    if (!option.isFullPath) {
        fp = await fullPath(path)
    }
    if (!fs.existsSync(fp)) {
        return null
    }
    const f = fs.openSync(fp, 'r')
    const content = fs.readFileSync(f)
    fs.closeSync(f)
    return content
}

const deletes = async (path: string, option?: { isFullPath: boolean, }) => {
    option = Object.assign({
        isFullPath: false,
    }, option)
    let fp = path
    if (!option.isFullPath) {
        fp = await fullPath(path)
    }
    if (!fs.existsSync(fp)) {
        return
    }
    const stat = fs.statSync(fp)
    if (stat.isDirectory()) {
        fs.rmdirSync(fp, {recursive: true})
    } else {
        fs.unlinkSync(fp)
    }
}
const rename = async (pathOld: string, pathNew: string, option?: {
    isFullPath: boolean,
    overwrite: boolean
}) => {
    option = Object.assign({
        isFullPath: false,
    }, option)
    let fullPathOld = pathOld
    let fullPathNew = pathNew
    if (!option.isFullPath) {
        fullPathOld = await fullPath(pathOld)
        fullPathNew = await fullPath(pathNew)
    }
    if (!fs.existsSync(fullPathOld)) {
        return
    }
    if (fs.existsSync(fullPathNew)) {
        throw new Error(`File already exists: ${fullPathNew}`)
    }
    const dir = nodePath.dirname(fullPathNew)
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, {recursive: true})
    }
    fs.renameSync(fullPathOld, fullPathNew)
}

const copy = async (pathOld: string, pathNew: string, option?: { isFullPath: boolean, }) => {
    option = Object.assign({
        isFullPath: false,
    }, option)
    let fullPathOld = pathOld
    let fullPathNew = pathNew
    if (!option.isFullPath) {
        fullPathOld = await fullPath(pathOld)
        fullPathNew = await fullPath(pathNew)
    }
    if (!fs.existsSync(fullPathOld)) {
        throw new Error(`FileNotFound:${fullPathOld}`)
    }
    if (fs.existsSync(fullPathNew)) {
        throw new Error(`FileAlreadyExists:${fullPathNew}`)
    }
    // console.log('copy', fullPathOld, fullPathNew)
    fs.copyFileSync(fullPathOld, fullPathNew)
}

const tempRoot = async () => {
    await waitAppEnvReady()
    const tempDir = path.join(AppEnv.userData, 'temp')
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, {recursive: true})
    }
    return tempDir
}

const temp = async (ext: string = 'tmp', prefix: string = 'file') => {
    const root = await tempRoot()
    const p = [
        prefix,
        TimeUtil.timestampInMs(),
        StrUtil.randomString(32),
    ].join('_')
    return path.join(root, `${p}.${ext}`)
}

const tempDir = async (prefix: string = 'dir') => {
    const root = await tempRoot()
    const p = [
        prefix,
        TimeUtil.timestampInMs(),
        StrUtil.randomString(32),
    ].join('_')
    const dir = path.join(root, p)
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, {recursive: true})
    }
    return dir
}

const watchText = async (path: string, callback: (data: {}) => void, option?: {
    isFullPath: boolean,
    limit: number,
}): Promise<{
    stop: Function,
}> => {
    if (!path) {
        throw new Error('path is empty')
    }
    option = Object.assign({
        isFullPath: false,
        limit: 0,
    }, option)
    let fp = path
    if (!option.isFullPath) {
        fp = await fullPath(path)
    }
    let watcher = null
    let fd = null
    let isFirstReading = true
    let firstReadingLines = []
    const watchFileExists = () => {
        if (fs.existsSync(fp)) {
            watcher = null
            watchFileContent()
            return
        }
        watcher = setTimeout(() => {
            watchFileExists()
        }, 1000)
    }
    const watchFileContent = () => {
        const CHUNK_SIZE = 16 * 1024;
        const fd = fs.openSync(fp, 'r')
        let position = 0
        let lineNumber = 0
        let content = ''
        const parseContentLine = () => {
            while (true) {
                const index = content.indexOf('\n')
                if (index < 0) {
                    break
                }
                const line = content.substring(0, index)
                content = content.substring(index + 1)
                const lineItem = {
                    num: lineNumber++,
                    text: line,
                }
                if (option.limit > 0 && isFirstReading) {
                    // 限制显示模式并且是第一次读取，暂时先不回调
                    firstReadingLines.push(lineItem)
                    while (firstReadingLines.length >= option.limit) {
                        firstReadingLines.shift()
                    }
                } else {
                    callback(lineItem)
                }
                // console.log('watchText.line', line, content)
            }
        }
        const readChunk = () => {
            const buf = new Buffer(CHUNK_SIZE);
            const bytesRead = fs.readSync(fd, buf, 0, CHUNK_SIZE, position)
            position += bytesRead
            content += buf.toString('utf8', 0, bytesRead)
            parseContentLine()
            if (bytesRead < CHUNK_SIZE) {
                isFirstReading = false
                if (firstReadingLines.length > 0) {
                    firstReadingLines.forEach((lineItem) => {
                        callback(lineItem)
                    })
                    firstReadingLines = []
                }
                watcher = setTimeout(readChunk, 1000);
            } else {
                readChunk()
            }
        }
        readChunk()
    }
    watchFileExists()
    const stop = () => {
        // console.log('watchText stop', fp)
        if (fd) {
            fs.closeSync(fd)
        }
        if (watcher) {
            clearTimeout(watcher)
        }
    }
    // console.log('watchText', fp)
    return {
        stop,
    }
}

let appendTextPathCached = null
let appendTextStreamCached = null

const appendText = async (path: string, data: any, option?: { isFullPath: boolean, }) => {
    option = Object.assign({
        isFullPath: false,
    }, option)
    let fp = path
    if (!option.isFullPath) {
        fp = await fullPath(path)
    }
    if (path !== appendTextPathCached) {
        appendTextPathCached = path
        if (appendTextStreamCached) {
            appendTextStreamCached.end()
            appendTextStreamCached = null
        }
        const fullPathDir = nodePath.dirname(fp)
        if (!fs.existsSync(fullPathDir)) {
            fs.mkdirSync(fullPathDir, {recursive: true})
        }
        appendTextStreamCached = fs.createWriteStream(fp, {flags: 'a'})
    }
    appendTextStreamCached.write(data)
}

export default {
    fullPath,
    absolutePath,
    exists,
    isDirectory,
    mkdir,
    list,
    listAll,
    write,
    writeBuffer,
    read,
    readBuffer,
    deletes,
    rename,
    copy,
    temp,
    tempDir,
    watchText,
    appendText,
}
