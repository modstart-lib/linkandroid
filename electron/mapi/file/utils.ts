import fs from 'node:fs'
import path from 'node:path'
import {Readable} from 'node:stream'
import {ReadableStream} from 'node:stream/web'
import electron from 'electron'
import {AppEnv, waitAppEnvReady} from '../env'
import {ConfigIndex} from '../config'

const nodePath = path

export const toNodeReadableStream = (stream: any) => {
    if (stream instanceof ReadableStream) {
        return Readable.fromWeb(stream)
    }
    if (typeof stream.getReader === 'function') {
        const nodeStream = new ReadableStream({
            async pull(controller) {
                const reader = stream.getReader()
                while (true) {
                    const {done, value} = await reader.read()
                    if (done) break
                    controller.enqueue(value)
                }
                controller.close()
            },
        })
        return Readable.fromWeb(nodeStream)
    }
    throw new Error('Unsupported stream type')
}

export const toWebReadableStream = (stream: any) => {
    const reader = stream[Symbol.asyncIterator]()
    return new window.ReadableStream({
        async pull(controller) {
            const {value, done} = await reader.next()
            if (done) {
                controller.close()
            } else {
                controller.enqueue(value)
            }
        },
    })
}

export const root = () => {
    return AppEnv.dataRoot
}

export const absolutePath = (path: string) => {
    return `ABS://${path}`
}

export const fullPath = async (path: string) => {
    await waitAppEnvReady()
    if (path.startsWith('ABS://')) {
        return path.replace(/^ABS:\/\//, '')
    }
    return nodePath.join(root(), path)
}

export const ext = (path: string) => {
    if (!path) {
        return ''
    }
    if (path.startsWith('http://') || path.startsWith('https://')) {
        const url = new URL(path)
        path = url.pathname
    }
    return nodePath.extname(path).replace(/^\./, '')
}

export const textToName = (text: string, extStr: string = '', maxLimit: number = 100) => {
    if (text) {
        text = text.replace(/[\\\/\:\*\?\"\<\>\|]/g, '')
        text = text.replace(/[\r\n]/g, '')
        text = text.replace(/\s+/g, '')
        text = text.substring(0, maxLimit)
    }
    if (!text) {
        text = 'EMPTY'
    }
    if (!extStr) {
        return text
    }
    return `${text}.${extStr}`
}

export const pathToName = (path: string, includeExt: boolean = true, maxLimit: number = 100) => {
    if (!path) {
        return ''
    }
    path = path.replace(/\\/g, '/')
    const parts = path.split('/')
    const nameWithExt = parts[parts.length - 1]
    const nameParts = nameWithExt.split('.')
    let extStr = ''
    if (nameParts.length > 1) {
        extStr = '.' + nameParts.pop()
    }
    if (!includeExt) {
        extStr = ''
    }
    let result = nameParts.join('.')
    maxLimit -= extStr.length
    if (maxLimit > 0 && result.length > maxLimit) {
        result = result.substring(0, maxLimit)
    }
    if (!result) {
        result = 'EMPTY'
    }
    return `${result}${extStr}`
}

export const inDir = (path: string, dir: string) => {
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

export {nodePath}
