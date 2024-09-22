import {resolve} from "node:path";

export const isPackaged = ['true'].includes(process.env.IS_PACKAGED)

export const isDev = !isPackaged

export const buildResolve = (value: string) => {
    return resolve(`electron/resources/build/${value}`)
}

export const binResolve = (value: string) => {
    return resolve(process.resourcesPath, 'bin', value)
}

export const extraResolve = (filePath: string) => {
    const basePath = isPackaged ? process.resourcesPath : 'electron/resources'
    return resolve(basePath, 'extra', filePath)
}

