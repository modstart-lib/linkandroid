import fs from 'node:fs'
import path from 'node:path'
import {ConfigIndex} from '../config'
import {waitAppEnvReady} from '../env'
import {Log} from '../log'
import {StrUtil, TimeUtil} from '../../lib/util'
import {nodePath, inDir, fullPath} from './utils'
import {BasicFileOps} from './basic'

const hubRootDefault = async () => {
    await waitAppEnvReady()
    return path.join(nodePath.dirname(await fullPath('')), 'hub')
}

const hubRoot = async (): Promise<string> => {
    const hubDirDefault = await hubRootDefault()
    let hubDir = await ConfigIndex.get('hubRoot', '')
    if (!hubDir) {
        hubDir = hubDirDefault
    }
    if (!fs.existsSync(hubDir)) {
        fs.mkdirSync(hubDir, {recursive: true})
    }
    return hubDir
}

const _getHubSavePath = async (
    hubRoot: string,
    saveGroup: string,
    savePath: string,
    saveParam: {[key: string]: any},
    ext: string,
    autoCreateDir: boolean = false,
) => {
    if (!saveGroup) {
        saveGroup = 'file'
    }
    if (!savePath) {
        savePath = path.join(saveGroup, '{year}{month}{day}', '{hour}{minute}_{second}_{random}')
    }
    savePath = savePath.replace(/\\/g, '/')
    if (savePath.endsWith(`.${ext}`)) {
        savePath = savePath.substring(0, savePath.length - ext.length - 1)
    }
    for (const key in saveParam) {
        saveParam[key] = saveParam[key].toString().replace(/[^\w\u4e00-\u9fa5\-]/g, '')
        if (saveParam[key].length > 100) {
            saveParam[key] = saveParam[key].substring(0, 100)
        }
    }
    const param = {
        year: TimeUtil.replacePattern('{year}'),
        month: TimeUtil.replacePattern('{month}'),
        day: TimeUtil.replacePattern('{day}'),
        hour: TimeUtil.replacePattern('{hour}'),
        minute: TimeUtil.replacePattern('{minute}'),
        second: TimeUtil.replacePattern('{second}'),
        random: StrUtil.randomString(32),
        ...saveParam,
    }
    savePath = savePath.replace(/\{(\w+)\}/g, (match, key) => {
        return param[key] || key
    })
    while (await BasicFileOps.exists(path.join(hubRoot, savePath + `.${ext}`), {isDataPath: false})) {
        savePath = savePath + `-${StrUtil.randomString(3)}`
    }
    if (autoCreateDir) {
        const savePathFull = path.join(hubRoot, savePath)
        const dir = nodePath.dirname(savePathFull)
        if (!(await BasicFileOps.exists(dir, {isDataPath: false}))) {
            fs.mkdirSync(dir, {recursive: true})
        }
    }
    return `${savePath}.${ext}`
}

const hubDelete = async (
    file: string,
    option?: {isDataPath?: boolean; ignoreWhenNotInHub?: boolean; tryLaterWhenFailed?: boolean},
) => {
    option = Object.assign({isDataPath: false, ignoreWhenNotInHub: true, tryLaterWhenFailed: true}, option)
    let fp = file
    const hubRoot_ = await hubRoot()
    if (option.isDataPath) {
        fp = path.join(hubRoot_, file)
    }
    if (!(await isHubFile(fp))) {
        if (option.ignoreWhenNotInHub) {
            return
        }
    }
    if (!(await BasicFileOps.exists(fp, {isDataPath: false}))) {
        throw `HubDelete.FileNotFound - ${fp}`
    }
    const del = () => {
        BasicFileOps.deletes(fp, {isDataPath: false}).catch((err) => {
            if (option.tryLaterWhenFailed) {
                setTimeout(del, 1000)
            } else {
                Log.error(`HubDelete.Error: ${fp}`, err)
            }
        })
    }
    del()
}

const hubFullPath = async (file: string): Promise<string> => {
    if (!file) {
        throw 'HubSave.FilePathEmpty'
    }
    const hubRoot_ = await hubRoot()
    return path.join(hubRoot_, file)
}

const hubFile = async (
    ext: string,
    option?: {
        returnFullPath?: boolean
        autoCreateDir?: boolean
        saveGroup?: string
        savePath?: string
        savePathParam?: {[key: string]: any}
    },
) => {
    option = Object.assign(
        {returnFullPath: true, autoCreateDir: true, saveGroup: 'file', savePath: null, savePathParam: {}},
        option,
    )
    if (!ext) {
        throw 'HubSave.FilePathEmpty'
    }
    const hubRoot_ = await hubRoot()
    const savePath = await _getHubSavePath(
        hubRoot_,
        option.saveGroup,
        option.savePath,
        option.savePathParam,
        ext,
        option.autoCreateDir,
    )
    if (option.returnFullPath) {
        return path.join(hubRoot_, savePath)
    }
    return savePath
}

const isHubFile = async (file: string) => {
    const hubRoot_ = await hubRoot()
    return inDir(file, hubRoot_)
}

const hubSave = async (
    file: string,
    option?: {
        ext?: string
        returnFullPath?: boolean
        ignoreWhenInHub?: boolean
        cleanOld?: boolean
        saveGroup?: string
        savePath?: string
        savePathParam?: {[key: string]: any}
    },
) => {
    option = Object.assign(
        {
            ext: null,
            returnFullPath: true,
            ignoreWhenInHub: false,
            cleanOld: false,
            saveGroup: 'file',
            savePath: null,
            savePathParam: {},
        },
        option,
    )
    if (!file) {
        throw 'HubSave.FilePathEmpty'
    }
    if (!fs.existsSync(file)) {
        throw `HubSave.FileNotFound - ${file}`
    }
    if (!option.ext) {
        option.ext = BasicFileOps.ext(file)
    }
    const hubRoot_ = await hubRoot()
    if (option.ignoreWhenInHub) {
        if (inDir(file, hubRoot_)) {
            return file
        }
    }
    const savePath = await _getHubSavePath(
        hubRoot_,
        option.saveGroup,
        option.savePath,
        option.savePathParam,
        option.ext,
    )
    const savePathFull = path.join(hubRoot_, savePath)
    if (option.cleanOld) {
        await BasicFileOps.rename(file, savePathFull, {isDataPath: false})
        if (await BasicFileOps.exists(file, {isDataPath: false})) {
            BasicFileOps.deletes(file, {isDataPath: false}).then()
        }
    } else {
        await BasicFileOps.copy(file, savePathFull, {isDataPath: false})
    }
    if (option.returnFullPath) {
        return savePathFull
    }
    return savePath
}

const hubSaveContent = async (
    content: string,
    option: {
        ext: string
        returnFullPath?: boolean
        saveGroup?: string
        savePath?: string
        savePathParam?: {[key: string]: any}
    },
) => {
    option = Object.assign(
        {ext: null, returnFullPath: true, saveGroup: 'file', savePath: null, savePathParam: {}},
        option,
    )
    const hubRoot_ = await hubRoot()
    const savePath = await _getHubSavePath(
        hubRoot_,
        option.saveGroup,
        option.savePath,
        option.savePathParam,
        option.ext,
    )
    const savePathFull = path.join(hubRoot_, savePath)
    await BasicFileOps.write(savePathFull, content, {isDataPath: false})
    if (option.returnFullPath) {
        return savePathFull
    }
    return savePath
}

export const HubOps = {
    hubRootDefault,
    hubRoot,
    hubSave,
    hubSaveContent,
    hubDelete,
    hubFile,
    hubFullPath,
    isHubFile,
}
