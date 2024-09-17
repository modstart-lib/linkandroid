import {resolve} from "node:path";

export const isPackaged = ['true'].includes(process.env.IS_PACKAGED)

export const buildResolve = (value: string) =>
    resolve(`electron/resources/build/${value}`)

export const extraResolve = (filePath: string) => {
    const basePath = isPackaged ? process.resourcesPath : 'electron/resources'
    const value = resolve(basePath, 'extra', filePath)
    return value
}

