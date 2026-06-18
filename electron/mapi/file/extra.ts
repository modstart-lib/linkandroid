import fs, {createWriteStream} from 'node:fs'
import path from 'node:path'
import {Readable} from 'node:stream'
import electron from 'electron'
import {finished} from 'stream/promises'
import {EncodeUtil, StrUtil, TimeUtil} from '../../lib/util'
import Apps from '../app'
import {Log} from '../log'
import {waitAppEnvReady} from '../env'
import {fullPath, nodePath, toNodeReadableStream, toWebReadableStream} from './utils'
import {BasicFileOps} from './basic'

const tempRoot = async () => {
    await waitAppEnvReady()
    const root = await fullPath('temp')
    if (!fs.existsSync(root)) {
        fs.mkdirSync(root, {recursive: true})
    }
    return root
}

const autoCleanTemp = async (keepDays: number = 7) => {
    const root = await tempRoot()
    if (!fs.existsSync(root)) {
        return
    }
    const files = fs.readdirSync(root)
    const now = new Date()
    for (const file of files) {
        const filePath = path.join(root, file)
        const stat = fs.statSync(filePath)
        if (stat.isDirectory()) {
            continue
        }
        const lastModified = new Date(stat.mtimeMs)
        const diffDays = Math.floor((now.getTime() - lastModified.getTime()) / (1000 * 60 * 60 * 24))
        if (diffDays >= keepDays) {
            fs.unlinkSync(filePath)
            Log.info('AutoCleanTemp.Clean', filePath)
        }
    }
}

const tempName = async (ext: string = 'tmp', prefix: string = 'file', suffix: string = ''): Promise<string> => {
    const parts = [prefix, TimeUtil.timestampInMs(), StrUtil.randomString(32)]
    if (suffix) {
        parts.push(suffix)
    }
    const p = parts.join('_')
    return `${p}.${ext}`
}

const temp = async (ext: string = 'tmp', prefix: string = 'file', suffix: string = ''): Promise<string> => {
    const root = await tempRoot()
    return path.join(root, await tempName(ext, prefix, suffix))
}

const tempDir = async (prefix: string = 'dir'): Promise<string> => {
    const root = await tempRoot()
    const p = [prefix, TimeUtil.timestampInMs(), StrUtil.randomString(32)].join('_')
    const dir = path.join(root, p)
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, {recursive: true})
    }
    return dir
}

const writeStream = async (path: string, data: any, option?: {isDataPath?: boolean}) => {
    option = Object.assign({isDataPath: false}, option)
    let fp = path
    if (option.isDataPath) {
        fp = await fullPath(path)
    }
    const fullPathDir = nodePath.dirname(fp)
    if (!fs.existsSync(fullPathDir)) {
        fs.mkdirSync(fullPathDir, {recursive: true})
    }
    if (electron.ipcRenderer) {
        data = toNodeReadableStream(data)
    }
    const fileStream = createWriteStream(fp)
    data.pipe(fileStream)
    await finished(fileStream)
}

const readStream = async (path: string, option?: {isDataPath?: boolean}) => {
    option = Object.assign({isDataPath: false}, option)
    let fp = path
    if (option.isDataPath) {
        fp = await fullPath(path)
    }
    if (!fs.existsSync(fp)) {
        throw `FileNotFound: ${fp}`
    }
    const stream = fs.createReadStream(fp)
    if (electron.ipcRenderer) {
        return toWebReadableStream(stream)
    }
    return stream
}

const readLine = async (path: string, callback: (line: string) => void, option?: {isDataPath?: boolean}) => {
    option = Object.assign({isDataPath: false}, option)
    let fp = path
    if (option.isDataPath) {
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

const watchText = async (
    path: string,
    callback: (data: {}) => void,
    option?: {isDataPath?: boolean; limit?: number},
): Promise<{stop: Function}> => {
    if (!path) {
        throw new Error('path is empty')
    }
    option = Object.assign({isDataPath: false, limit: 0}, option)
    let fp = path
    if (option.isDataPath) {
        fp = await fullPath(path)
    }
    let watcher = null
    let fd = null
    let isFirstReading = true
    let firstReadingLines: any[] = []
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
        const CHUNK_SIZE = 16 * 1024
        fd = fs.openSync(fp, 'r')
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
                const lineItem = {num: lineNumber++, text: line}
                if (option.limit > 0 && isFirstReading) {
                    firstReadingLines.push(lineItem)
                    while (firstReadingLines.length >= option.limit) {
                        firstReadingLines.shift()
                    }
                } else {
                    callback(lineItem)
                }
            }
        }
        const readChunk = () => {
            const buf = new Buffer(CHUNK_SIZE)
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
                watcher = setTimeout(readChunk, 1000)
            } else {
                readChunk()
            }
        }
        readChunk()
    }
    watchFileExists()
    const stop = () => {
        if (fd) {
            fs.closeSync(fd)
        }
        if (watcher) {
            clearTimeout(watcher)
        }
    }
    return {stop}
}

let appendTextPathCached = null
let appendTextStreamCached = null

const appendText = async (path: string, data: any, option?: {isDataPath?: boolean}) => {
    option = Object.assign({isDataPath: false}, option)
    let fp = path
    if (option.isDataPath) {
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

const download = async (
    url: string,
    filePath: string | null = null,
    option?: {isDataPath?: boolean; userAgent?: string; progress?: (percent: number, total: number) => void},
): Promise<string> => {
    option = Object.assign({isDataPath: false, userAgent: Apps.getUserAgent(), progress: null}, option)
    if (!filePath) {
        const ext = BasicFileOps.ext(url)
        filePath = await temp(ext || 'bin', 'download')
        option.isDataPath = false
    }
    let fp = filePath
    if (option.isDataPath) {
        fp = await fullPath(filePath)
    }
    const fullPathDir = nodePath.dirname(fp)
    if (!fs.existsSync(fullPathDir)) {
        fs.mkdirSync(fullPathDir, {recursive: true})
    }
    const res = await fetch(url, {
        method: 'GET',
        headers: {'User-Agent': option.userAgent},
    })
    if (!res.ok) {
        throw new Error(`DownloadError:${url}`)
    }
    const contentLength = res.headers.get('content-length')
    const totalSize = contentLength ? parseInt(contentLength, 10) : null
    let downloaded = 0
    let readableStream = toNodeReadableStream(res.body)
    const fileStream = fs.createWriteStream(fp)
    return new Promise((resolve, reject) => {
        readableStream
            .on('data', (chunk) => {
                downloaded += chunk.length
                if (totalSize) {
                    option.progress && option.progress(downloaded / totalSize, totalSize)
                }
                fileStream.write(chunk)
            })
            .on('end', () => {
                fileStream.end()
                resolve(fp)
            })
            .on('error', (err) => {
                fileStream.close()
                reject(err)
            })
    })
}

const _sortObjectDeep = (obj: any): any => {
    if (Array.isArray(obj)) {
        return obj.map(_sortObjectDeep)
    } else if (obj && typeof obj === 'object') {
        return Object.keys(obj)
            .sort()
            .reduce((acc, key) => {
                acc[key] = _sortObjectDeep(obj[key])
                return acc
            }, {} as any)
    }
    return obj
}

const cacheKey = async (key: any): Promise<string> => {
    const keyObjString = JSON.stringify(_sortObjectDeep(key))
    const keyMd5 = EncodeUtil.md5(keyObjString)
    return path.join(await tempRoot(), `FileCache_${keyMd5}`)
}

const cacheForget = async (key: any): Promise<void> => {
    const keyPath = await cacheKey(key)
    if (await BasicFileOps.exists(keyPath)) {
        await BasicFileOps.deletes(keyPath)
    }
}

const cacheSet = async (key: any, data: any): Promise<void> => {
    const keyPath = await cacheKey(key)
    await BasicFileOps.write(keyPath, JSON.stringify(data))
}

const cacheGet = async (key: any): Promise<any | null> => {
    const keyPath = await cacheKey(key)
    if (!(await BasicFileOps.exists(keyPath))) {
        return null
    }
    const content = await BasicFileOps.read(keyPath)
    if (!content) {
        return null
    }
    try {
        return JSON.parse(content)
    } catch (e) {
        return null
    }
}

const cacheGetPath = async (key: any): Promise<string | null> => {
    const p = await cacheGet(key)
    if (!p) {
        return null
    }
    if (!(await BasicFileOps.exists(p))) {
        await cacheForget(key)
        return null
    }
    return p
}

export const ExtraOps = {
    writeStream,
    readStream,
    readLine,
    tempRoot,
    autoCleanTemp,
    tempName,
    temp,
    tempDir,
    watchText,
    appendText,
    download,
    cacheForget,
    cacheSet,
    cacheGetPath,
    cacheGet,
}
