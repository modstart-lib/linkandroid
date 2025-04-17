import path from "node:path";
import {AppEnv, waitAppEnvReady} from "../env";
import fs from "node:fs";
import {StrUtil, TimeUtil} from "../../lib/util";
import Apps from "../app";
import {Readable} from "node:stream";
import {isWin} from "../../lib/env";

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

const exists = async (path: string, option?: { isFullPath?: boolean, }) => {
    option = Object.assign({
        isFullPath: false,
    }, option)
    let fp = path
    if (!option.isFullPath) {
        fp = await fullPath(path)
    }
    return new Promise((resolve, reject) => {
        fs.stat(fp, (err, stat) => {
            if (err) {
                resolve(false)
            } else {
                resolve(true)
            }
        })
    })
}

const isDirectory = async (path: string, option?: { isFullPath?: boolean, }) => {
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

const mkdir = async (path: string, option?: { isFullPath?: boolean, }) => {
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

const list = async (path: string, option?: { isFullPath?: boolean, }) => {
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
            pathname: nodePath.join(fp, file),
            isDirectory: stat.isDirectory(),
            size: stat.size,
            lastModified: stat.mtimeMs,
        }
        return f
    })
}

const listAll = async (path: string, option?: { isFullPath?: boolean, }) => {
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

const write = async (path: string, data: any, option?: { isFullPath?: boolean, }) => {
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

const writeBuffer = async (path: string, data: any, option?: { isFullPath?: boolean, }) => {
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

const read = async (path: string, option?: {
    isFullPath?: boolean,
    encoding?: string,
}) => {
    option = Object.assign({
        isFullPath: false,
        encoding: 'utf8'
    }, option)
    let fp = path
    if (!option.isFullPath) {
        fp = await fullPath(path)
    }
    if (!fs.existsSync(fp)) {
        return null
    }
    const f = fs.openSync(fp, 'r')
    const content = fs.readFileSync(f, {
        encoding: option.encoding as BufferEncoding
    })
    fs.closeSync(f)
    return content
}

const readBuffer = async (path: string, option?: { isFullPath?: boolean, }): Promise<Buffer> => {
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
    return new Promise((resolve, reject) => {
        fs.readFile(fp, (err, data) => {
            if (err) {
                reject(err)
                return
            }
            resolve(data)
        })
    })
}

const readLine = async (path: string, callback: (line: string) => void, option?: {
    isFullPath?: boolean,
}) => {
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
    return new Promise((resolve, reject) => {
        const f = fs.createReadStream(fp)
        let remaining = ''
        f.on('data', (chunk) => {
            remaining += chunk
            let index = remaining.indexOf('\n')
            let last = 0
            while (index > -1) {
                let line = remaining.substring(last, index)
                last = index + 1
                callback(line)
                index = remaining.indexOf('\n', last)
            }
            remaining = remaining.substring(last)
        })
        f.on('end', () => {
            if (remaining.length > 0) {
                callback(remaining)
            }
            resolve(undefined)
        })
    })
}

const deletes = async (path: string, option?: { isFullPath?: boolean, }) => {
    option = Object.assign({
        isFullPath: false,
    }, option)
    let fp = path
    if (!option.isFullPath) {
        fp = await fullPath(path)
    }
    if (!await exists(fp, {
        isFullPath: true
    })) {
        return
    }
    return new Promise((resolve, reject) => {
        fs.stat(fp, (err, stat) => {
            if (err) {
                reject(err)
                return
            }
            if (stat.isDirectory()) {
                fs.rmdir(fp, {recursive: true}, (err) => {
                    if (err) {
                        reject(err)
                        return
                    }
                    resolve(undefined)
                })
            } else {
                fs.unlink(fp, (err) => {
                    if (err) {
                        reject(err)
                        return
                    }
                    resolve(undefined)
                })
            }
        })
    })
}
const rename = async (pathOld: string, pathNew: string, option?: {
    isFullPath?: boolean,
    overwrite?: boolean
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
    let success = false
    try {
        fs.renameSync(fullPathOld, fullPathNew)
        success = true
    } catch (e) {
    }
    if (!success) {
        // cross-device link not permitted, rename
        fs.copyFileSync(fullPathOld, fullPathNew)
        fs.unlinkSync(fullPathOld)
    }
}

const copy = async (pathOld: string, pathNew: string, option?: { isFullPath?: boolean, }) => {
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
    const dir = nodePath.dirname(fullPathNew)
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, {recursive: true})
    }
    fs.copyFileSync(fullPathOld, fullPathNew)
}

const hubRoot = async () => {
    await waitAppEnvReady()
    const hubDir = path.join(root(), 'hub')
    if (!fs.existsSync(hubDir)) {
        fs.mkdirSync(hubDir, {recursive: true})
    }
    return hubDir
}

const hubCreate = async (ext: string = 'bin') => {
    return path.join(
        'hub',
        TimeUtil.replacePattern('{year}'),
        TimeUtil.replacePattern('{month}'),
        TimeUtil.replacePattern('{day}'),
        TimeUtil.replacePattern('{hour}'),
        [
            TimeUtil.replacePattern('{minute}'),
            TimeUtil.replacePattern('{second}'),
            StrUtil.randomString(10),
        ].join('_') + `.${ext}`
    )
}

const hubSave = async (file: string, option?: {
    ext?: string,
    isFullPath?: boolean,
    returnFullPath?: boolean,
    ignoreWhenInHub?: boolean,
}) => {
    option = Object.assign({
        ext: null,
        isFullPath: false,
        returnFullPath: false,
        ignoreWhenInHub: false,
    }, option)
    let fp = file
    if (!option.isFullPath) {
        fp = await fullPath(file)
    }
    if (!fs.existsSync(fp)) {
        throw `FileNotFound ${fp}`
    }
    if (!option.ext) {
        option.ext = ext(fp)
    }
    if (option.ignoreWhenInHub) {
        const hubRoot_ = await hubRoot()
        if (inDir(fp, hubRoot_)) {
            return fp
        }
    }
    const hubFile = await hubCreate(option.ext)
    await copy(fp, path.join(root(), hubFile), {
        isFullPath: true,
    })
    if (option.returnFullPath) {
        return path.join(root(), hubFile)
    }
    return hubFile
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
    isFullPath?: boolean,
    limit?: number,
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

const appendText = async (path: string, data: any, option?: { isFullPath?: boolean, }) => {
    option = Object.assign({
        isFullPath: false,
    }, option)
    let fp = path
    if (!option.isFullPath) {
        fp = await fullPath(path)
    }
    if (fp !== appendTextPathCached) {
        appendTextPathCached = fp
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

const download = async (url: string, path: string, option?: {
    isFullPath?: boolean,
    progress?: (percent: number, total: number) => void,
}) => {
    option = Object.assign({
        isFullPath: false,
        progress: null,
    }, option)
    let fp = path
    if (!option.isFullPath) {
        fp = await fullPath(path)
    }
    const fullPathDir = nodePath.dirname(fp)
    if (!fs.existsSync(fullPathDir)) {
        fs.mkdirSync(fullPathDir, {recursive: true})
    }
    const res = await fetch(url, {
        method: 'GET',
        headers: {
            'User-Agent': Apps.getUserAgent()
        },
    })
    if (!res.ok) {
        throw new Error(`DownloadError:${url}`)
    }

    const contentLength = res.headers.get('content-length');
    const totalSize = contentLength ? parseInt(contentLength, 10) : null;
    let downloaded = 0;

    // @ts-ignore
    const readableStream = Readable.fromWeb(res.body);
    const fileStream = fs.createWriteStream(fp)
    return new Promise((resolve, reject) => {
        readableStream
            .on('data', (chunk) => {
                // console.log('download.data', chunk.length)
                downloaded += chunk.length;
                if (totalSize) {
                    option.progress && option.progress(downloaded / totalSize, totalSize)
                }
                fileStream.write(chunk)
            })
            .on('end', () => {
                // console.log('download.end')
                fileStream.end();
                resolve(undefined)
            })
            .on('error', (err) => {
                // console.log('download.error', err)
                fileStream.close()
                reject(err)
            })
    })
}

const ext = (path: string) => {
    return nodePath.extname(path).replace(/^\./, '')
}

const textToName = (text: string, ext: string = '', maxLimit: number = 100) => {
    if (text) {
        // 转换为合法的文件名
        text = text.replace(/[\\\/\:\*\?\"\<\>\|]/g, '')
        text = text.replace(/[\r\n]/g, '')
        text = text.replace(/\s+/g, '')
        text = text.substring(0, maxLimit)
    }
    if (!text) {
        text = 'EMPTY'
    }
    if (!ext) {
        return text
    }
    return `${text}.${ext}`
}

const inDir = (path: string, dir: string) => {
    if (!path || !dir) {
        return false
    }
    path = path.replace(/\\/g, '/')
    dir = dir.replace(/\\/g, '/')
    if (path === dir) {
        return true
    }
    return path.startsWith(dir)
}

export const FileIndex = {
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
    readLine,
    deletes,
    rename,
    copy,
    temp,
    tempDir,
    watchText,
    appendText,
    download,
    ext,
    hubSave,
    textToName,
}

export default FileIndex
