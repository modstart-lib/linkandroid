import fs from "node:fs";

import yauzl from "yauzl";
import archiver from "archiver";

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
            zipfile.on("end", function () {
                // console.log('getZipFileContent end')
                reject("FileNotFound")
            })
            zipfile.on("entry", function (entry: any) {
                // console.log('getZipFileContent entry', entry.fileName)
                if (entry.fileName === pathInZip) {
                    zipfile.openReadStream(entry, function (err: any, readStream: any) {
                        if (err) {
                            reject(err)
                            return
                        }
                        let chunks: any[] = []
                        readStream.on("data", function (chunk: any) {
                            chunks.push(chunk)
                        })
                        readStream.on("end", function () {
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

const unzip = async (
    zipPath: string,
    dest: string,
    option?: {
        process: (type: 'start' | 'end', entry: any) => void
    }
) => {
    option = Object.assign({
        process: null
    }, option)
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
            zipfile.on('error', function (err: any) {
                // console.log('unzip error', err)
                reject(err)
            })
            zipfile.on("end", function () {
                // console.log('unzip end')
                resolve(true)
            })
            zipfile.on("entry", function (entry: any) {
                if (option.process) {
                    option.process('start', entry)
                }
                // console.log('unzip entry', dest, entry.fileName)
                const destPath = dest + '/' + entry.fileName
                if (/\/$/.test(entry.fileName)) {
                    // console.log('unzip mkdir', destPath)
                    fs.mkdirSync(destPath, {recursive: true})
                    zipfile.readEntry()
                } else {
                    const dirname = destPath.replace(/\/[^/]+$/, '')
                    if (!fs.existsSync(dirname)) {
                        fs.mkdirSync(dirname, {recursive: true})
                    }
                    zipfile.openReadStream(entry, function (err: any, readStream: any) {
                        if (err) {
                            reject(err)
                            return
                        }
                        readStream.on("end", function () {
                            if (option.process) {
                                option.process('end', entry)
                            }
                            zipfile.readEntry()
                        })
                        readStream.pipe(fs.createWriteStream(destPath))
                    })
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
        end?: (archive: any) => void,
    }
) => {
    option = Object.assign({
        end: null,
    }, option)
    return new Promise((resolve, reject) => {
        const output = fs.createWriteStream(zipPath)
        const archive = archiver('zip', {
            zlib: {level: 9}
        })
        output.on('close', function () {
            resolve(true)
        })
        archive.on('error', function (err: any) {
            reject(err)
        })
        archive.pipe(output)
        archive.directory(sourceDir, false)
        if (option.end) {
            option.end(archive)
        }
        archive.finalize()
    })
}

export const Misc = {
    getZipFileContent,
    unzip,
    zip,
}

export default Misc
