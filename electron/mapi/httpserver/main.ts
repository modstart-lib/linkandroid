import adbkitPkg from '@devicefarmer/adbkit'
import {ipcMain} from 'electron'
import crypto from 'node:crypto'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import {extraResolveBin} from '../../lib/env'
import Apps from '../app'
import {AppEnv} from '../env'
import {Log} from '../log/main'
const {Adb} = adbkitPkg as any

let server: http.Server | null = null
let runningPort = 0
let runningToken = ''

const generateToken = (): string => {
    return crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '')
}

const writeCliAuthFile = (port: number, token: string): void => {
    try {
        const filePath = path.join(AppEnv.userData, 'cli-auth.json')
        fs.writeFileSync(filePath, JSON.stringify({port, token}), 'utf-8')
    } catch (e) {
        Log.error('httpserver.writeCliAuthFile.error', e)
    }
}

const sendJson = (res: http.ServerResponse, statusCode: number, data: any) => {
    const body = JSON.stringify(data)
    res.writeHead(statusCode, {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
    })
    res.end(body)
}

const getAdbBin = (): string | null => {
    try {
        return extraResolveBin('scrcpy/adb')
    } catch {
        return null
    }
}

const listDevices = async (): Promise<any[]> => {
    const bin = getAdbBin()
    const client = Adb.createClient(bin ? {bin} : {})
    try {
        const devices = await client.listDevicesWithPaths()
        return devices.map((d: any) => ({
            id: d.id,
            type: d.type,
            path: d.path || null,
        }))
    } finally {
        client.kill().catch(() => {})
    }
}

const handleRequest = async (req: http.IncomingMessage, res: http.ServerResponse, token: string) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

    if (req.method === 'OPTIONS') {
        res.writeHead(200)
        res.end()
        return
    }

    const url = req.url || '/'

    // Health check (no auth required)
    if (url === '/' && req.method === 'GET') {
        sendJson(res, 200, {code: 0, msg: 'LinkAndroid HTTP API'})
        return
    }

    // Token validation
    const auth = req.headers['authorization'] || ''
    if (!auth.startsWith('Bearer ') || auth.slice(7) !== token) {
        sendJson(res, 401, {code: -1, msg: 'Unauthorized'})
        return
    }

    // Routing
    if (url === '/api/devices' && req.method === 'POST') {
        try {
            const devices = await listDevices()
            sendJson(res, 200, {code: 0, data: devices})
        } catch (e: any) {
            Log.error('httpserver.devices.error', e)
            sendJson(res, 500, {code: -1, msg: String(e)})
        }
        return
    }

    sendJson(res, 404, {code: -1, msg: 'Not Found'})
}

const start = async (): Promise<number> => {
    if (server) {
        return runningPort
    }

    runningPort = await Apps.availablePort(53030, 'httpserver', 60)
    runningToken = generateToken()

    server = http.createServer((req, res) => {
        handleRequest(req, res, runningToken).catch((e) => {
            Log.error('httpserver.request.error', e)
            sendJson(res, 500, {code: -1, msg: 'Internal Server Error'})
        })
    })

    await new Promise<void>((resolve, reject) => {
        server!.listen(runningPort, '127.0.0.1', () => resolve())
        server!.on('error', reject)
    })

    writeCliAuthFile(runningPort, runningToken)
    Log.info(`HTTP server started on port ${runningPort}`)
    return runningPort
}

const stop = () => {
    if (server) {
        server.close()
        server = null
        Log.info('HTTP server stopped')
    }
}

const getPort = (): number => runningPort
const getToken = (): string => runningToken

ipcMain.handle('httpserver:getPort', () => getPort())
ipcMain.handle('httpserver:getToken', () => getToken())

export default {
    start,
    stop,
    getPort,
    getToken,
}
