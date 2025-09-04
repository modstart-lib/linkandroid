import fs, {createWriteStream} from "node:fs";
import path from "node:path";
import {Readable} from "node:stream";
import {ReadableStream} from "node:stream/web";
import {StrUtil, TimeUtil} from "../../lib/util";
import Apps from "../app";
import {ConfigIndex} from "../config";
import {AppEnv, waitAppEnvReady} from "../env";
import {Log} from "../log";
import electron from "electron";
import {finished} from "stream/promises";

const nodePath = path;

const root = () => {
    return AppEnv.dataRoot
};

const absolutePath = (path: string) => {
    return `ABS://${path}`;
};

const fullPath = async (path: string) => {
    await waitAppEnvReady();
    if (path.startsWith("ABS://")) {
        return path.replace(/^ABS:\/\//, "");
    }
    return nodePath.join(root(), path);
};

const exists = async (path: string, option?: { isFullPath?: boolean }) => {
    option = Object.assign(
        {
            isFullPath: false,
        },
        option
    );
    let fp = path;
    if (!option.isFullPath) {
        fp = await fullPath(path);
    }
    return new Promise((resolve, reject) => {
        fs.stat(fp, (err, stat) => {
            if (err) {
                resolve(false);
            } else {
                resolve(true);
            }
        });
    });
};

const isDirectory = async (path: string, option?: { isFullPath?: boolean }) => {
    option = Object.assign(
        {
            isFullPath: false,
        },
        option
    );
    let fp = path;
    if (!option.isFullPath) {
        fp = await fullPath(path);
    }
    if (!fs.existsSync(fp)) {
        return false;
    }
    return fs.statSync(fp).isDirectory();
};

const mkdir = async (path: string, option?: { isFullPath?: boolean }) => {
    option = Object.assign(
        {
            isFullPath: false,
        },
        option
    );
    let fp = path;
    if (!option.isFullPath) {
        fp = await fullPath(path);
    }
    if (!fs.existsSync(fp)) {
        fs.mkdirSync(fp, {recursive: true});
    }
};

const list = async (path: string, option?: { isFullPath?: boolean }) => {
    option = Object.assign(
        {
            isFullPath: false,
        },
        option
    );
    let fp = path;
    if (!option.isFullPath) {
        fp = await fullPath(path);
    }
    if (!fs.existsSync(fp)) {
        return [];
    }
    const files = fs.readdirSync(fp);
    return files.map(file => {
        const stat = fs.statSync(nodePath.join(fp, file));
        let f = {
            name: file,
            pathname: nodePath.join(fp, file),
            isDirectory: stat.isDirectory(),
            size: stat.size,
            lastModified: stat.mtimeMs,
        };
        return f;
    });
};

const listAll = async (path: string, option?: { isFullPath?: boolean }) => {
    option = Object.assign(
        {
            isFullPath: false,
        },
        option
    );
    let fp = path;
    if (!option.isFullPath) {
        fp = await fullPath(path);
    }
    if (!fs.existsSync(fp)) {
        return [];
    }
    const listDirectory = (path: string, basePath: string = "") => {
        let files = [];
        const list = fs.readdirSync(path);
        for (let file of list) {
            const stat = fs.statSync(nodePath.join(path, file));
            let fPath = nodePath.join(basePath, file);
            fPath = fPath.replace(/\\/g, "/");
            let f = {
                name: file,
                path: fPath,
                isDirectory: stat.isDirectory(),
                size: stat.size,
                lastModified: stat.mtimeMs,
            };
            if (f.isDirectory) {
                files = files.concat(listDirectory(nodePath.join(path, file), f.path));
                continue;
            }
            files.push(f);
        }
        return files;
    };
    return listDirectory(fp);
};

const write = async (path: string, data: any, option?: { isFullPath?: boolean }) => {
    option = Object.assign(
        {
            isFullPath: false,
        },
        option
    );
    let fp = path;
    if (!option.isFullPath) {
        fp = await fullPath(path);
    }
    const fullPathDir = nodePath.dirname(fp);
    if (!fs.existsSync(fullPathDir)) {
        fs.mkdirSync(fullPathDir, {recursive: true});
    }
    if (typeof data === "string") {
        data = {
            content: data,
        };
    }
    const f = fs.openSync(fp, "w");
    fs.writeSync(f, data.content);
    fs.closeSync(f);
};

const writeStream = async (path: string, data: any, option?: { isFullPath?: boolean }) => {
    option = Object.assign(
        {
            isFullPath: false,
        },
        option
    );
    let fp = path;
    if (!option.isFullPath) {
        fp = await fullPath(path);
    }
    const fullPathDir = nodePath.dirname(fp);
    if (!fs.existsSync(fullPathDir)) {
        fs.mkdirSync(fullPathDir, {recursive: true});
    }
    if (electron.ipcRenderer) {
        const webToNode = (stream: any) => {
            if (stream instanceof ReadableStream) {
                // 已经是 Node.js 版本的 WHATWG ReadableStream
                return Readable.fromWeb(stream);
            }
            if (typeof stream.getReader === "function") {
                // 浏览器版本 → 包装成 Node.js 兼容的
                const nodeStream = new ReadableStream({
                    async pull(controller) {
                        const reader = stream.getReader();
                        while (true) {
                            const {done, value} = await reader.read();
                            if (done) break;
                            controller.enqueue(value);
                        }
                        controller.close();
                    },
                });
                return Readable.fromWeb(nodeStream);
            }
            throw new Error("Unsupported stream type");
        }
        data = webToNode(data);
    }
    const fileStream = createWriteStream(fp);
    data.pipe(fileStream);
    await finished(fileStream);
};

const writeBuffer = async (path: string, data: any, option?: { isFullPath?: boolean }) => {
    option = Object.assign(
        {
            isFullPath: false,
        },
        option
    );
    let fp = path;
    if (!option.isFullPath) {
        fp = await fullPath(path);
    }
    const fullPathDir = nodePath.dirname(fp);
    if (!fs.existsSync(fullPathDir)) {
        fs.mkdirSync(fullPathDir, {recursive: true});
    }
    const f = fs.openSync(fp, "w");
    fs.writeSync(f, data);
    fs.closeSync(f);
};

const read = async (
    path: string,
    option?: {
        isFullPath?: boolean;
        encoding?: string;
    }
) => {
    option = Object.assign(
        {
            isFullPath: false,
            encoding: "utf8",
        },
        option
    );
    let fp = path;
    if (!option.isFullPath) {
        fp = await fullPath(path);
    }
    if (!fs.existsSync(fp)) {
        return null;
    }
    const f = fs.openSync(fp, "r");
    const content = fs.readFileSync(f, {
        encoding: option.encoding as BufferEncoding,
    });
    fs.closeSync(f);
    return content;
};

const readBuffer = async (path: string, option?: { isFullPath?: boolean }): Promise<Buffer> => {
    option = Object.assign(
        {
            isFullPath: false,
        },
        option
    );
    let fp = path;
    if (!option.isFullPath) {
        fp = await fullPath(path);
    }
    if (!fs.existsSync(fp)) {
        return null;
    }
    return new Promise((resolve, reject) => {
        fs.readFile(fp, (err, data) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(data);
        });
    });
};

const readStream = async (path: string, option?: { isFullPath?: boolean }) => {
    option = Object.assign(
        {
            isFullPath: false,
        },
        option
    );
    let fp = path;
    if (!option.isFullPath) {
        fp = await fullPath(path);
    }
    if (!fs.existsSync(fp)) {
        return null;
    }
    const stream = fs.createReadStream(fp);
    if (electron.ipcRenderer) {
        const nodeToWeb = (nodeStream: any) => {
            const reader = nodeStream[Symbol.asyncIterator]();
            return new window.ReadableStream({
                async pull(controller) {
                    const {value, done} = await reader.next();
                    if (done) {
                        controller.close();
                    } else {
                        controller.enqueue(value);
                    }
                }
            });
        }
        return nodeToWeb(stream);
    }
    return stream;
}

const readLine = async (
    path: string,
    callback: (line: string) => void,
    option?: {
        isFullPath?: boolean;
    }
) => {
    option = Object.assign(
        {
            isFullPath: false,
        },
        option
    );
    let fp = path;
    if (!option.isFullPath) {
        fp = await fullPath(path);
    }
    if (!fs.existsSync(fp)) {
        return;
    }
    return new Promise((resolve, reject) => {
        const f = fs.createReadStream(fp);
        let remaining = "";
        f.on("data", chunk => {
            remaining += chunk;
            let index = remaining.indexOf("\n");
            let last = 0;
            while (index > -1) {
                let line = remaining.substring(last, index);
                last = index + 1;
                callback(line);
                index = remaining.indexOf("\n", last);
            }
            remaining = remaining.substring(last);
        });
        f.on("end", () => {
            if (remaining.length > 0) {
                callback(remaining);
            }
            resolve(undefined);
        });
    });
};

const clean = async (paths: string[], option?: { isFullPath?: boolean }) => {
    if (!paths || !Array.isArray(paths) || paths.length === 0) {
        return;
    }
    for (const path of paths) {
        try {
            await deletes(path, option);
        } catch (e) {
            Log.error(`CleanError: ${path}`, e);
        }
    }
};

const deletes = async (path: string, option?: { isFullPath?: boolean }) => {
    option = Object.assign(
        {
            isFullPath: false,
        },
        option
    );
    let fp = path;
    if (!option.isFullPath) {
        fp = await fullPath(path);
    }
    if (
        !(await exists(fp, {
            isFullPath: true,
        }))
    ) {
        return;
    }
    return new Promise((resolve, reject) => {
        fs.stat(fp, (err, stat) => {
            if (err) {
                reject(err);
                return;
            }
            if (stat.isDirectory()) {
                fs.rmdir(fp, {recursive: true}, err => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve(undefined);
                });
            } else {
                fs.unlink(fp, err => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve(undefined);
                });
            }
        });
    });
};
const rename = async (
    pathOld: string,
    pathNew: string,
    option?: {
        isFullPath?: boolean;
        overwrite?: boolean;
    }
) => {
    option = Object.assign(
        {
            isFullPath: false,
        },
        option
    );
    let fullPathOld = pathOld;
    let fullPathNew = pathNew;
    if (!option.isFullPath) {
        fullPathOld = await fullPath(pathOld);
        fullPathNew = await fullPath(pathNew);
    }
    if (!fs.existsSync(fullPathOld)) {
        throw `Rename.FileNotFound - ${fullPathOld}`;
    }
    if (fs.existsSync(fullPathNew)) {
        throw new Error(`File already exists: ${fullPathNew}`);
    }
    const dir = nodePath.dirname(fullPathNew);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, {recursive: true});
    }
    let success = false;
    try {
        fs.renameSync(fullPathOld, fullPathNew);
        success = true;
    } catch (e) {
    }
    if (!success) {
        // cross-device link not permitted, rename
        fs.copyFileSync(fullPathOld, fullPathNew);
        fs.unlinkSync(fullPathOld);
    }
};

const copy = async (pathOld: string, pathNew: string, option?: { isFullPath?: boolean }) => {
    option = Object.assign(
        {
            isFullPath: false,
        },
        option
    );
    let fullPathOld = pathOld;
    let fullPathNew = pathNew;
    if (!option.isFullPath) {
        fullPathOld = await fullPath(pathOld);
        fullPathNew = await fullPath(pathNew);
    }
    if (!fs.existsSync(fullPathOld)) {
        throw `Copy.FileNotFound - ${fullPathOld}`;
    }
    if (fs.existsSync(fullPathNew)) {
        throw `FileAlreadyExists:${fullPathNew}`;
    }
    // console.log('copy', fullPathOld, fullPathNew)
    const dir = nodePath.dirname(fullPathNew);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, {recursive: true});
    }
    fs.copyFileSync(fullPathOld, fullPathNew);
};

const hubRootDefault = async () => {
    await waitAppEnvReady();
    return path.join(root(), "hub");
};

const hubRoot = async () => {
    const hubDirDefault = await hubRootDefault();
    let hubDir = await ConfigIndex.get("hubRoot", "");
    if (!hubDir) {
        hubDir = hubDirDefault;
    }
    if (!fs.existsSync(hubDir)) {
        fs.mkdirSync(hubDir, {recursive: true});
    }
    return hubDir;
};

const _getHubSavePath = async (
    hubRoot: string,
    saveGroup: string,
    savePath: string,
    saveParam: {
        [key: string]: any;
    },
    ext: string,
    autoCreateDir: boolean = false
) => {
    if (!saveGroup) {
        saveGroup = "file";
    }
    if (!savePath) {
        savePath = path.join(saveGroup, "{year}{month}{day}", "{hour}{minute}_{second}_{random}");
    }
    savePath = savePath.replace(/\\/g, "/");
    if (savePath.endsWith(`.${ext}`)) {
        savePath = savePath.substring(0, savePath.length - ext.length - 1);
    }
    for (const key in saveParam) {
        // only allow alphanumeric, Chinese characters, and hyphens
        saveParam[key] = saveParam[key].toString().replace(/[^\w\u4e00-\u9fa5\-]/g, "");
        // length limit
        if (saveParam[key].length > 100) {
            saveParam[key] = saveParam[key].substring(0, 100);
        }
    }
    const param = {
        year: TimeUtil.replacePattern("{year}"),
        month: TimeUtil.replacePattern("{month}"),
        day: TimeUtil.replacePattern("{day}"),
        hour: TimeUtil.replacePattern("{hour}"),
        minute: TimeUtil.replacePattern("{minute}"),
        second: TimeUtil.replacePattern("{second}"),
        random: StrUtil.randomString(10),
        ...saveParam,
    };
    savePath = savePath.replace(/\{(\w+)\}/g, (match, key) => {
        return param[key] || key;
    });
    while (
        await exists(path.join(hubRoot, savePath + `.${ext}`), {
            isFullPath: true,
        })
        ) {
        savePath = savePath + `-${StrUtil.randomString(3)}`;
    }
    if (autoCreateDir) {
        const savePathFull = path.join(hubRoot, savePath);
        const dir = nodePath.dirname(savePathFull);
        if (!(await exists(dir, {isFullPath: true}))) {
            fs.mkdirSync(dir, {recursive: true});
        }
    }
    return `${savePath}.${ext}`;
};

const hubDelete = async (
    file: string,
    option?: {
        isFullPath?: boolean;
        ignoreWhenNotInHub?: boolean;
        tryLaterWhenFailed?: boolean;
    }
) => {
    option = Object.assign(
        {
            isFullPath: false,
            ignoreWhenNotInHub: true,
            tryLaterWhenFailed: true,
        },
        option
    );
    let fp = file;
    const hubRoot_ = await hubRoot();
    if (!option.isFullPath) {
        fp = path.join(hubRoot_, file);
    }
    if (!(await isHubFile(fp))) {
        if (option.ignoreWhenNotInHub) {
            return;
        }
    }
    if (!(await exists(fp, {isFullPath: true}))) {
        throw `HubDelete.FileNotFound - ${fp}`;
    }
    const del = () => {
        deletes(fp, {isFullPath: true}).catch(err => {
            if (option.tryLaterWhenFailed) {
                setTimeout(del, 1000);
            } else {
                Log.error(`HubDelete.Error: ${fp}`, err);
            }
        });
    };
    del();
};

const hubFullPath = async (file: string): Promise<string> => {
    if (!file) {
        throw "HubSave.FilePathEmpty";
    }
    const hubRoot_ = await hubRoot();
    return path.join(hubRoot_, file);
};

const hubFile = async (
    ext: string,
    option?: {
        returnFullPath?: boolean;
        autoCreateDir?: boolean;
        saveGroup?: string;
        savePath?: string;
        savePathParam?: {
            [key: string]: any;
        };
    }
) => {
    option = Object.assign(
        {
            returnFullPath: false,
            autoCreateDir: true,
            saveGroup: "file",
            savePath: null,
            savePathParam: {},
        },
        option
    );
    if (!ext) {
        throw "HubSave.FilePathEmpty";
    }
    const hubRoot_ = await hubRoot();
    const savePath = await _getHubSavePath(
        hubRoot_,
        option.saveGroup,
        option.savePath,
        option.savePathParam,
        ext,
        option.autoCreateDir
    );
    if (option.returnFullPath) {
        return path.join(hubRoot_, savePath);
    }
    return savePath;
};

const isHubFile = async (file: string) => {
    const hubRoot_ = await hubRoot();
    return inDir(file, hubRoot_);
};

const hubSave = async (
    file: string,
    option?: {
        ext?: string;
        returnFullPath?: boolean;
        ignoreWhenInHub?: boolean;
        cleanOld?: boolean;
        saveGroup?: string;
        savePath?: string;
        savePathParam?: {
            [key: string]: any;
        };
    }
) => {
    option = Object.assign(
        {
            ext: null,
            returnFullPath: true,
            ignoreWhenInHub: false,
            cleanOld: false,
            saveGroup: "file",
            savePath: null,
            savePathParam: {},
        },
        option
    );
    if (!file) {
        throw "HubSave.FilePathEmpty";
    }
    if (!fs.existsSync(file)) {
        throw `HubSave.FileNotFound - ${file}`;
    }
    if (!option.ext) {
        option.ext = ext(file);
    }
    const hubRoot_ = await hubRoot();
    if (option.ignoreWhenInHub) {
        if (inDir(file, hubRoot_)) {
            return file;
        }
    }
    const savePath = await _getHubSavePath(
        hubRoot_,
        option.saveGroup,
        option.savePath,
        option.savePathParam,
        option.ext
    );
    const savePathFull = path.join(hubRoot_, savePath);
    if (option.cleanOld) {
        await rename(file, savePathFull, {isFullPath: true});
        if (await exists(file, {isFullPath: true})) {
            deletes(file, {isFullPath: true}).then();
        }
    } else {
        await copy(file, savePathFull, {
            isFullPath: true,
        });
    }
    if (option.returnFullPath) {
        return savePathFull;
    }
    return savePath;
};

const tempRoot = async () => {
    await waitAppEnvReady();
    const tempDir = path.join(AppEnv.userData, "temp");
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, {recursive: true});
    }
    return tempDir;
};

const autoCleanTemp = async (keepDays: number = 1) => {
    const root = await tempRoot();
    if (!fs.existsSync(root)) {
        return;
    }
    const files = fs.readdirSync(root);
    const now = new Date();
    for (const file of files) {
        const filePath = path.join(root, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            continue; // skip directories
        }
        const lastModified = new Date(stat.mtimeMs);
        const diffDays = Math.floor((now.getTime() - lastModified.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays > keepDays) {
            fs.unlinkSync(filePath);
        }
    }
};

const temp = async (ext: string = "tmp", prefix: string = "file", suffix: string = "") => {
    const root = await tempRoot();
    const parts = [prefix, TimeUtil.timestampInMs(), StrUtil.randomString(32)];
    if (suffix) {
        parts.push(suffix);
    }
    const p = parts.join("_");
    return path.join(root, `${p}.${ext}`);
};

const tempDir = async (prefix: string = "dir") => {
    if (Math.random() < 0.1) {
        // 10% chance to clean temp directory
        autoCleanTemp(1).then();
    }
    const root = await tempRoot();
    const p = [prefix, TimeUtil.timestampInMs(), StrUtil.randomString(32)].join("_");
    const dir = path.join(root, p);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, {recursive: true});
    }
    return dir;
};

const watchText = async (
    path: string,
    callback: (data: {}) => void,
    option?: {
        isFullPath?: boolean;
        limit?: number;
    }
): Promise<{
    stop: Function;
}> => {
    if (!path) {
        throw new Error("path is empty");
    }
    option = Object.assign(
        {
            isFullPath: false,
            limit: 0,
        },
        option
    );
    let fp = path;
    if (!option.isFullPath) {
        fp = await fullPath(path);
    }
    let watcher = null;
    let fd = null;
    let isFirstReading = true;
    let firstReadingLines = [];
    const watchFileExists = () => {
        if (fs.existsSync(fp)) {
            watcher = null;
            watchFileContent();
            return;
        }
        watcher = setTimeout(() => {
            watchFileExists();
        }, 1000);
    };
    const watchFileContent = () => {
        const CHUNK_SIZE = 16 * 1024;
        const fd = fs.openSync(fp, "r");
        let position = 0;
        let lineNumber = 0;
        let content = "";
        const parseContentLine = () => {
            while (true) {
                const index = content.indexOf("\n");
                if (index < 0) {
                    break;
                }
                const line = content.substring(0, index);
                content = content.substring(index + 1);
                const lineItem = {
                    num: lineNumber++,
                    text: line,
                };
                if (option.limit > 0 && isFirstReading) {
                    // 限制显示模式并且是第一次读取，暂时先不回调
                    firstReadingLines.push(lineItem);
                    while (firstReadingLines.length >= option.limit) {
                        firstReadingLines.shift();
                    }
                } else {
                    callback(lineItem);
                }
                // console.log('watchText.line', line, content)
            }
        };
        const readChunk = () => {
            const buf = new Buffer(CHUNK_SIZE);
            const bytesRead = fs.readSync(fd, buf, 0, CHUNK_SIZE, position);
            position += bytesRead;
            content += buf.toString("utf8", 0, bytesRead);
            parseContentLine();
            if (bytesRead < CHUNK_SIZE) {
                isFirstReading = false;
                if (firstReadingLines.length > 0) {
                    firstReadingLines.forEach(lineItem => {
                        callback(lineItem);
                    });
                    firstReadingLines = [];
                }
                watcher = setTimeout(readChunk, 1000);
            } else {
                readChunk();
            }
        };
        readChunk();
    };
    watchFileExists();
    const stop = () => {
        // console.log('watchText stop', fp)
        if (fd) {
            fs.closeSync(fd);
        }
        if (watcher) {
            clearTimeout(watcher);
        }
    };
    // console.log('watchText', fp)
    return {
        stop,
    };
};

let appendTextPathCached = null;
let appendTextStreamCached = null;

const appendText = async (path: string, data: any, option?: { isFullPath?: boolean }) => {
    option = Object.assign(
        {
            isFullPath: false,
        },
        option
    );
    let fp = path;
    if (!option.isFullPath) {
        fp = await fullPath(path);
    }
    if (fp !== appendTextPathCached) {
        appendTextPathCached = fp;
        if (appendTextStreamCached) {
            appendTextStreamCached.end();
            appendTextStreamCached = null;
        }
        const fullPathDir = nodePath.dirname(fp);
        if (!fs.existsSync(fullPathDir)) {
            fs.mkdirSync(fullPathDir, {recursive: true});
        }
        appendTextStreamCached = fs.createWriteStream(fp, {flags: "a"});
    }
    appendTextStreamCached.write(data);
};

const download = async (
    url: string,
    path: string,
    option?: {
        isFullPath?: boolean;
        progress?: (percent: number, total: number) => void;
    }
) => {
    option = Object.assign(
        {
            isFullPath: false,
            progress: null,
        },
        option
    );
    let fp = path;
    if (!option.isFullPath) {
        fp = await fullPath(path);
    }
    const fullPathDir = nodePath.dirname(fp);
    if (!fs.existsSync(fullPathDir)) {
        fs.mkdirSync(fullPathDir, {recursive: true});
    }
    const res = await fetch(url, {
        method: "GET",
        headers: {
            "User-Agent": Apps.getUserAgent(),
        },
    });
    if (!res.ok) {
        throw new Error(`DownloadError:${url}`);
    }

    const contentLength = res.headers.get("content-length");
    const totalSize = contentLength ? parseInt(contentLength, 10) : null;
    let downloaded = 0;

    // @ts-ignore
    const readableStream = Readable.fromWeb(res.body);
    const fileStream = fs.createWriteStream(fp);
    return new Promise((resolve, reject) => {
        readableStream
            .on("data", chunk => {
                // console.log('download.data', chunk.length)
                downloaded += chunk.length;
                if (totalSize) {
                    option.progress && option.progress(downloaded / totalSize, totalSize);
                }
                fileStream.write(chunk);
            })
            .on("end", () => {
                // console.log('download.end')
                fileStream.end();
                resolve(undefined);
            })
            .on("error", err => {
                // console.log('download.error', err)
                fileStream.close();
                reject(err);
            });
    });
};

/**
 * get file extension from file path or url
 * @param path
 */
const ext = (path: string) => {
    if (!path) {
        return "";
    }
    if (path.startsWith("http://") || path.startsWith("https://")) {
        // 处理 URL
        const url = new URL(path);
        path = url.pathname;
    }
    return nodePath.extname(path).replace(/^\./, "");
};

const textToName = (text: string, ext: string = "", maxLimit: number = 100) => {
    if (text) {
        // 转换为合法的文件名
        text = text.replace(/[\\\/\:\*\?\"\<\>\|]/g, "");
        text = text.replace(/[\r\n]/g, "");
        text = text.replace(/\s+/g, "");
        text = text.substring(0, maxLimit);
    }
    if (!text) {
        text = "EMPTY";
    }
    if (!ext) {
        return text;
    }
    return `${text}.${ext}`;
};

const inDir = (path: string, dir: string) => {
    if (!path || !dir) {
        return false;
    }
    path = path.replace(/\\/g, "/");
    dir = dir.replace(/\\/g, "/");
    if (path === dir) {
        return true;
    }
    return path.startsWith(dir);
};

const pathToName = (path: string, includeExt: boolean = true, maxLimit: number = 100) => {
    if (!path) {
        return "";
    }
    path = path.replace(/\\/g, "/");
    const parts = path.split("/");
    const nameWithExt = parts[parts.length - 1];
    const nameParts = nameWithExt.split(".");
    let ext = ''
    if (nameParts.length > 1) {
        ext = '.' + nameParts.pop();
    }
    if (!includeExt) {
        ext = '';
    }
    let result = nameParts.join(".");
    maxLimit -= ext.length;
    if (maxLimit > 0 && result.length > maxLimit) {
        result = result.substring(0, maxLimit);
    }
    if (!result) {
        result = "EMPTY";
    }
    return `${result}${ext}`;
};

export const FileIndex = {
    fullPath,
    absolutePath,
    exists,
    isDirectory,
    mkdir,
    list,
    listAll,
    write,
    writeStream,
    writeBuffer,
    read,
    readBuffer,
    readStream,
    readLine,
    clean,
    deletes,
    rename,
    copy,
    temp,
    tempDir,
    watchText,
    appendText,
    download,
    ext,
    textToName,
    pathToName,
    hubRootDefault,
    hubSave,
    hubDelete,
    hubFile,
    hubFullPath,
    isHubFile,
};

export default FileIndex;
