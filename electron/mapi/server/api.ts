import {net} from 'electron'
import {Client, handle_file} from "@gradio/client";
import {platformArch, platformName} from "../../lib/env";
import {Events} from "../event/main";
import {Apps} from "../app";
import {Files} from "../file/main";
import fs from 'node:fs'

const request = async (url, data?: {}, option?: {}) => {
    option = Object.assign({
        method: 'GET',
        timeout: 60 * 1000,
        headers: {
            'Content-Type': 'application/json'
        },
        responseType: 'json' as 'json'
    })
    if (option['method'] === 'GET') {
        url += '?'
        for (let key in data) {
            url += `${key}=${data[key]}&`
        }
    }
    return new Promise((resolve, reject) => {
        const req = net.request({
            url,
            method: option['method'],
            headers: option['headers'],
        })
        req.on('response', (response) => {
            let body = ''
            response.on('data', (chunk) => {
                body += chunk.toString()
            })
            response.on('end', () => {
                if ('json' === option['responseType']) {
                    try {
                        resolve(JSON.parse(body))
                    } catch (e) {
                        resolve({code: -1, msg: `ResponseError: ${body}`})
                    }
                } else {
                    resolve(body)
                }
            })
        })
        req.on('error', (err) => {
            reject(err)
        })
        req.end()
    })
}

const requestPost = async (url, data?: {}, option?: {}) => {
    option = Object.assign({
        method: 'POST',
    })
    return request(url, data, option)
}

const requestGet = async (url, data?: {}, option?: {}) => {
    option = Object.assign({
        method: 'GET',
    })
    return request(url, data, option)
}

const requestPostSuccess = async (url, data?: {}, option?: {}) => {
    const res = await requestPost(url, data, option)
    if (res['code'] === 0) {
        return res
    }
    throw new Error(res['msg'])
}

const requestUrlFileToLocal = async (url, path) => {
    return new Promise((resolve, reject) => {
        const req = net.request(url)
        req.on('response', (response) => {
            const file = fs.createWriteStream(path)
            // @ts-ignore
            response.pipe(file)
            file.on('finish', () => {
                file.close()
                resolve('x')
            })
        })
        req.on('error', (err) => {
            reject(err)
        })
        req.end()
    })
}

export default {
    GradioClient: Client,
    GradioHandleFile: handle_file,
    event: Events,
    file: Files,
    app: Apps,
    request,
    requestPost,
    requestGet,
    requestPostSuccess,
    requestUrlFileToLocal,
    platformName: platformName(),
    platformArch: platformArch(),
}
