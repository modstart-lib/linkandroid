import {ZipArchive} from 'archiver'
import axios from 'axios'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import yauzl from 'yauzl'

const getZipFileContent = async (path: string, pathInZip: string) => {
    return new Promise((resolve, reject) => {
        // console.log('getZipFileContent', path, pathInZip)
        yauzl.open(path, {lazyEntries: true}, (err: any, zipfile: any) => {
            if (err) {
                // console.log('getZipFileContent err', err)
                reject(err)
                return
            }
            zipfile.on('error', function (err: any) {
                // console.log('getZipFileContent error', err)
                reject(err)
            })
            zipfile.on('end', function () {
                // console.log('getZipFileContent end')
                reject('FileNotFound')
            })
            zipfile.on('entry', function (entry: any) {
                // console.log('getZipFileContent entry', entry.fileName)
                if (entry.fileName === pathInZip) {
                    zipfile.openReadStream(entry, function (err: any, readStream: any) {
                        if (err) {
                            reject(err)
                            return
                        }
                        let chunks: any[] = []
                        readStream.on('data', function (chunk: any) {
                            chunks.push(chunk)
                        })
                        readStream.on('end', function () {
                            const bytes = Buffer.concat(chunks)
                            const text = bytes.toString('utf8')
                            resolve(text)
                        })
                    })
                } else {
                    zipfile.readEntry()
                }
            })
            zipfile.readEntry()
        })
    })
}

const UNZIP_MAX_ENTRIES = 2000
const UNZIP_MAX_TOTAL_BYTES = 50 * 1024 * 1024

const unzipSafeRelPath = (dest: string, fileName: string) => {
    const name = String(fileName || '').replace(/\\/g, '/')
    if (!name.replace(/\/+$/, '')) return null
    if (name.startsWith('/') || /^[a-zA-Z]:/.test(name)) {
        throw new Error('ZipPathInvalid')
    }
    const segments = name.split('/')
    if (segments.some((segment) => segment === '..' || segment === '.')) {
        throw new Error('ZipPathInvalid')
    }
    const base = path.resolve(dest)
    const target = path.resolve(base, name)
    if (target !== base && !target.startsWith(base + path.sep)) {
        throw new Error('ZipPathInvalid')
    }
    return target
}

const isSymlinkEntry = (entry: any) => {
    const attributes = entry?.externalFileAttributes || 0
    return (attributes >>> 16 && (attributes >>> 16) & 0o170000) === 0o120000
}

const unzip = async (
    zipPath: string,
    dest: string,
    option?: {
        process: (type: 'start' | 'end', entry: any) => void
    },
) => {
    option = Object.assign(
        {
            process: null,
        },
        option,
    )
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, {recursive: true})
    }
    return new Promise((resolve, reject) => {
        // console.log('unzip', zipPath, dest)
        yauzl.open(zipPath, {lazyEntries: true}, (err: any, zipfile: any) => {
            if (err) {
                // console.log('unzip err', err)
                reject(err)
                return
            }
            let entryCount = 0
            let totalBytes = 0
            const fail = (e: any) => {
                try {
                    zipfile.close()
                } catch {}
                reject(e instanceof Error ? e : new Error(String(e)))
            }
            zipfile.on('error', function (err: any) {
                // console.log('unzip error', err)
                fail(err)
            })
            zipfile.on('end', function () {
                // console.log('unzip end')
                resolve(undefined)
            })
            zipfile.on('entry', function (entry: any) {
                if (option.process) {
                    option.process('start', entry)
                }
                try {
                    if (isSymlinkEntry(entry)) {
                        throw new Error('ZipSymlinkRejected')
                    }
                    entryCount++
                    totalBytes += Number(entry.uncompressedSize || 0)
                    if (entryCount > UNZIP_MAX_ENTRIES || totalBytes > UNZIP_MAX_TOTAL_BYTES) {
                        throw new Error('ZipTooLarge')
                    }
                    const isDir = /\/$/.test(String(entry.fileName || '').replace(/\\/g, '/'))
                    const destPath = unzipSafeRelPath(dest, entry.fileName)
                    if (!destPath) {
                        zipfile.readEntry()
                        return
                    }
                    if (isDir) {
                        fs.mkdirSync(destPath, {recursive: true})
                        zipfile.readEntry()
                    } else {
                        const dirname = path.dirname(destPath)
                        if (!fs.existsSync(dirname)) {
                            fs.mkdirSync(dirname, {recursive: true})
                        }
                        zipfile.openReadStream(entry, function (err: any, readStream: any) {
                            if (err) {
                                fail(err)
                                return
                            }
                            readStream.on('end', function () {
                                if (option.process) {
                                    option.process('end', entry)
                                }
                                zipfile.readEntry()
                            })
                            readStream.on('error', function (err: any) {
                                fail(err)
                            })
                            readStream.pipe(fs.createWriteStream(destPath))
                        })
                    }
                } catch (e) {
                    fail(e)
                }
            })
            zipfile.readEntry()
        })
    })
}

const zip = async (
    zipPath: string,
    sourceDir: string,
    option?: {
        end?: (archive: any) => Promise<void>
        filter?: (params: {name: string; path: string; fullPath: string; isDir: boolean}) => Promise<boolean>
    },
): Promise<void> => {
    option = Object.assign(
        {
            end: null,
            filter: null,
        },
        option,
    )
    return new Promise((resolve, reject) => {
        const output = fs.createWriteStream(zipPath)
        const archive = new ZipArchive({
            zlib: {level: 9},
        })
        output.on('close', function () {
            resolve(undefined)
        })
        archive.on('error', function (err: any) {
            reject(err)
        })
        archive.pipe(output)

        const addFiles = async (dir: string, relativePath: string = '') => {
            const items = fs.readdirSync(path.join(dir, relativePath))
            for (const item of items) {
                const fullPath = path.join(dir, relativePath, item)
                const relPath = path.join(relativePath, item).replace(/\\/g, '/') // Normalize for zip
                const stat = fs.statSync(fullPath)
                const isDir = stat.isDirectory()
                const shouldInclude =
                    !option.filter ||
                    (await option.filter({
                        name: item,
                        path: relPath,
                        fullPath,
                        isDir,
                    }))
                if (isDir) {
                    if (shouldInclude) {
                        await addFiles(dir, relPath)
                    }
                } else {
                    if (shouldInclude) {
                        archive.file(fullPath, {name: relPath})
                    }
                }
            }
        }

        addFiles(sourceDir)
            .then(async () => {
                if (option.end) {
                    await option.end(archive)
                }
                archive.finalize()
            })
            .catch(reject)
    })
}

const request = async (option: {
    url: string
    method?: 'GET' | 'POST'
    responseType?: 'json' | 'text' | 'arraybuffer'
    headers?: any
    data?: any
}) => {
    option = Object.assign(
        {
            url: '',
            method: 'GET',
            responseType: 'json',
            headers: {},
            data: null,
        },
        option,
    )
    const response = await axios.request({
        url: option.url,
        method: option.method,
        responseType: option.responseType === 'arraybuffer' ? 'arraybuffer' : 'text',
        headers: option.headers,
        data: option.data,
    })
    if (response.status !== 200) {
        throw new Error(`Request failed with status code ${response.status}`)
    }
    if (option.responseType === 'json') {
        return JSON.parse(response.data)
    } else if (option.responseType === 'text') {
        return response.data
    } else if (option.responseType === 'arraybuffer') {
        return Buffer.from(response.data)
    } else {
        return response.data
    }
}

const getNetworkInterfaces = () => {
    const interfaces = os.networkInterfaces()
    const result: Array<{name: string; address: string; family: string; internal: boolean}> = []

    for (const [name, addresses] of Object.entries(interfaces)) {
        if (!addresses) continue

        for (const addr of addresses) {
            // Filter out internal (loopback) addresses and only include IPv4
            if (!addr.internal && addr.family === 'IPv4') {
                result.push({
                    name,
                    address: addr.address,
                    family: addr.family,
                    internal: addr.internal,
                })
            }
        }
    }

    return result
}

export const Misc = {
    getZipFileContent,
    unzip,
    zip,
    request,
    getNetworkInterfaces,
}

export default Misc
