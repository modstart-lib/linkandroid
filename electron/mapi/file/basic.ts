import fs from 'node:fs'
import path from 'node:path'
import {Log} from '../log'
import {fullPath, nodePath, ext} from './utils'

const exists = async (path: string, option?: {isDataPath?: boolean}): Promise<boolean> => {
    option = Object.assign({isDataPath: false}, option)
    let fp = path
    if (option.isDataPath) {
        fp = await fullPath(path)
    }
    return new Promise((resolve) => {
        fs.stat(fp, (err) => {
            resolve(!err)
        })
    })
}

const isDirectory = async (path: string, option?: {isDataPath?: boolean}) => {
    option = Object.assign({isDataPath: false}, option)
    let fp = path
    if (option.isDataPath) {
        fp = await fullPath(path)
    }
    if (!fs.existsSync(fp)) {
        return false
    }
    return fs.statSync(fp).isDirectory()
}

const mkdir = async (path: string, option?: {isDataPath?: boolean}) => {
    option = Object.assign({isDataPath: false}, option)
    let fp = path
    if (option.isDataPath) {
        fp = await fullPath(path)
    }
    if (!fs.existsSync(fp)) {
        fs.mkdirSync(fp, {recursive: true})
    }
}

const list = async (path: string, option?: {isDataPath?: boolean}) => {
    option = Object.assign({isDataPath: false}, option)
    let fp = path
    if (option.isDataPath) {
        fp = await fullPath(path)
    }
    if (!fs.existsSync(fp)) {
        return []
    }
    const files = fs.readdirSync(fp)
    return files.map((file) => {
        const stat = fs.statSync(nodePath.join(fp, file))
        return {
            name: file,
            pathname: nodePath.join(fp, file),
            isDirectory: stat.isDirectory(),
            size: stat.size,
            lastModified: stat.mtimeMs,
        }
    })
}

const listAll = async (path: string, option?: {isDataPath?: boolean}) => {
    option = Object.assign({isDataPath: false}, option)
    let fp = path
    if (option.isDataPath) {
        fp = await fullPath(path)
    }
    if (!fs.existsSync(fp)) {
        return []
    }
    const listDirectory = (dirPath: string, basePath: string = '') => {
        let files: any[] = []
        const list = fs.readdirSync(dirPath)
        for (let file of list) {
            const stat = fs.statSync(nodePath.join(dirPath, file))
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
                files = files.concat(listDirectory(nodePath.join(dirPath, file), f.path))
                continue
            }
            files.push(f)
        }
        return files
    }
    return listDirectory(fp)
}

const write = async (path: string, data: any, option?: {isDataPath?: boolean}) => {
    option = Object.assign({isDataPath: false}, option)
    let fp = path
    if (option.isDataPath) {
        fp = await fullPath(path)
    }
    const fullPathDir = nodePath.dirname(fp)
    if (!fs.existsSync(fullPathDir)) {
        fs.mkdirSync(fullPathDir, {recursive: true})
    }
    if (typeof data === 'string') {
        data = {content: data}
    }
    const f = fs.openSync(fp, 'w')
    fs.writeSync(f, data.content)
    fs.closeSync(f)
}

const writeBuffer = async (path: string, data: any, option?: {isDataPath?: boolean}) => {
    option = Object.assign({isDataPath: false}, option)
    let fp = path
    if (option.isDataPath) {
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

const read = async (path: string, option?: {isDataPath?: boolean; encoding?: string}) => {
    option = Object.assign({isDataPath: false, encoding: 'utf8'}, option)
    let fp = path
    if (option.isDataPath) {
        fp = await fullPath(path)
    }
    if (!fs.existsSync(fp)) {
        return null
    }
    const f = fs.openSync(fp, 'r')
    const content = fs.readFileSync(f, {encoding: option.encoding as BufferEncoding})
    fs.closeSync(f)
    return content
}

const readBuffer = async (path: string, option?: {isDataPath?: boolean}): Promise<Buffer> => {
    option = Object.assign({isDataPath: false}, option)
    let fp = path
    if (option.isDataPath) {
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

const clean = async (paths: string[], option?: {isDataPath?: boolean}) => {
    if (!paths || !Array.isArray(paths) || paths.length === 0) {
        return
    }
    for (const p of paths) {
        try {
            await deletes(p, option)
        } catch (e) {
            Log.error(`CleanError: ${p}`, e)
        }
    }
}

const deletes = async (path: string, option?: {isDataPath?: boolean}): Promise<void> => {
    option = Object.assign({isDataPath: false}, option)
    let fp = path
    if (option.isDataPath) {
        fp = await fullPath(path)
    }
    if (!(await exists(fp, {isDataPath: false}))) {
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

const rename = async (pathOld: string, pathNew: string, option?: {isDataPath?: boolean; overwrite?: boolean}) => {
    option = Object.assign({isDataPath: false}, option)
    let fullPathOld = pathOld
    let fullPathNew = pathNew
    if (option.isDataPath) {
        fullPathOld = await fullPath(pathOld)
        fullPathNew = await fullPath(pathNew)
    }
    if (!fs.existsSync(fullPathOld)) {
        throw `Rename.FileNotFound - ${fullPathOld}`
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
    } catch (e) {}
    if (!success) {
        fs.copyFileSync(fullPathOld, fullPathNew)
        fs.unlinkSync(fullPathOld)
    }
}

const copy = async (pathOld: string, pathNew: string, option?: {isDataPath?: boolean; overwrite?: boolean}) => {
    option = Object.assign({isDataPath: false, overwrite: false}, option)
    let fullPathOld = pathOld
    let fullPathNew = pathNew
    if (option.isDataPath) {
        fullPathOld = await fullPath(pathOld)
        fullPathNew = await fullPath(pathNew)
    }
    if (!fs.existsSync(fullPathOld)) {
        throw `Copy.FileNotFound - ${fullPathOld}`
    }
    if (fs.existsSync(fullPathNew)) {
        if (option.overwrite) {
            await deletes(fullPathNew, {isDataPath: false})
        } else {
            throw `Copy.FileAlreadyExists - ${fullPathNew}`
        }
    }
    const dir = nodePath.dirname(fullPathNew)
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, {recursive: true})
    }
    fs.copyFileSync(fullPathOld, fullPathNew)
}

const stat = async (
    path: string,
    option?: {isDataPath?: boolean},
): Promise<{size: number; isDirectory: boolean; lastModified: number}> => {
    option = Object.assign({isDataPath: false}, option)
    let fp = path
    if (option.isDataPath) {
        fp = await fullPath(path)
    }
    const s = fs.statSync(fp)
    return {
        size: s.size,
        isDirectory: s.isDirectory(),
        lastModified: s.mtimeMs,
    }
}

export const BasicFileOps = {
    exists,
    isDirectory,
    mkdir,
    list,
    listAll,
    write,
    writeBuffer,
    read,
    readBuffer,
    clean,
    deletes,
    rename,
    copy,
    stat,
    ext,
}
