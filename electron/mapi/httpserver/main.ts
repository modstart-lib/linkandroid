import adbkitPkg from '@devicefarmer/adbkit'
import {ipcMain} from 'electron'
import crypto from 'node:crypto'
import express from 'express'
import fs from 'node:fs'
import path from 'node:path'
import type {Server} from 'node:http'
import {resolveAdbBin} from '../../lib/env'
import Apps from '../app'
import {AppEnv} from '../env'
import {Log} from '../log/main'
import DBMain from '../db/main'
import {runTaskById} from '../task/scheduler'
const {Adb} = adbkitPkg as any

let server: Server | null = null
let runningPort = 0
let runningToken = ''

const generateToken = (): string => {
    return crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '')
}

const writeCliAuthFile = (port: number, token: string): void => {
    try {
        const filePath = path.join(AppEnv.dataRoot, 'cli-auth.json')
        const dir = path.dirname(filePath)
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, {recursive: true})
        }
        fs.writeFileSync(filePath, JSON.stringify({port, token}), 'utf-8')
    } catch (e) {
        Log.error('httpserver.writeCliAuthFile.error', e)
    }
}

const getAdbBin = (): string | null => {
    try {
        return resolveAdbBin()
    } catch {
        return null
    }
}

const listSeedDevices = (): any[] => {
    try {
        const filePath = path.join(AppEnv.dataRoot, 'storage', 'device.json')
        if (!fs.existsSync(filePath)) {
            return []
        }
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'))
        return (data.records || [])
            .filter((d: any) => d.raw?.seedConnected === true)
            .map((d: any) => ({
                id: d.id,
                type: d.type,
                path: null,
            }))
    } catch {
        return []
    }
}

const listDevices = async (): Promise<any[]> => {
    const seedDevices = listSeedDevices()
    const bin = getAdbBin()
    const client = Adb.createClient(bin ? {bin} : {})
    try {
        const devices = await client.listDevicesWithPaths()
        const realDevices = devices.map((d: any) => ({
            id: d.id,
            type: d.id?.includes(':') ? 'wifi' : d.type === 'emulator' ? 'emulator' : 'usb',
            path: d.path || null,
        }))
        return [...seedDevices, ...realDevices.filter((d: any) => !seedDevices.some((s) => s.id === d.id))]
    } catch (e) {
        if (seedDevices.length > 0) {
            return seedDevices
        }
        throw e
    } finally {
        client.kill().catch(() => {})
    }
}

// ── Express App ────────────────────────────────────────────────────────────

const app = express()

// CORS
app.use((_req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    next()
})

// Body parser
app.use(express.json())

// Preflight (middleware instead of route to avoid path-to-regexp '*' issue)
app.use((req, res, next) => {
    if (req.method === 'OPTIONS') {
        res.status(200).end()
        return
    }
    next()
})

// Health check (no auth required)
app.get('/', (_req, res) => {
    res.json({code: 0, msg: 'LinkAndroid HTTP API'})
})

// Auth wall — all remaining routes require authentication
const requireAuth: express.RequestHandler = (req, res, next) => {
    const auth = req.headers['authorization'] || ''
    if (!auth.startsWith('Bearer ') || auth.slice(7) !== runningToken) {
        res.status(401).json({code: -1, msg: 'Unauthorized'})
        return
    }
    next()
}
app.use(requireAuth)

// ── Device API ─────────────────────────────────────────────────────────────

app.post('/api/devices', async (_req, res) => {
    try {
        const devices = await listDevices()
        res.json({code: 0, data: devices})
    } catch (e: any) {
        Log.error('httpserver.devices.error', e)
        res.status(500).json({code: -1, msg: String(e)})
    }
})

// ── Task API ───────────────────────────────────────────────────────────────

app.post('/api/task/list', async (_req, res) => {
    try {
        const tasks = await DBMain.select(
            `SELECT id, name, description, language, run_mode, cron_expression, created_at, updated_at
             FROM task ORDER BY id DESC`,
        )
        res.json({code: 0, data: tasks})
    } catch (e: any) {
        Log.error('httpserver.task.list.error', e)
        res.status(500).json({code: -1, msg: String(e)})
    }
})

app.post('/api/task/get', async (req, res) => {
    try {
        const id = req.body?.id
        if (!id) {
            res.status(400).json({code: -1, msg: 'Missing task id'})
            return
        }
        const task = await DBMain.first(
            `SELECT id, name, description, code, language, run_mode, cron_expression, created_at, updated_at
             FROM task WHERE id = ?`,
            [id],
        )
        if (!task) {
            res.status(404).json({code: -1, msg: 'Task not found'})
            return
        }
        res.json({code: 0, data: task})
    } catch (e: any) {
        Log.error('httpserver.task.get.error', e)
        res.status(500).json({code: -1, msg: String(e)})
    }
})

app.post('/api/task/run', async (req, res) => {
    try {
        const id = req.body?.id
        if (!id) {
            res.status(400).json({code: -1, msg: 'Missing task id'})
            return
        }
        const result = await runTaskById(Number(id))
        if (!result.success) {
            res.status(500).json({code: -1, msg: result.log})
            return
        }
        res.json({code: 0, data: {runId: result.runId, log: result.log}})
    } catch (e: any) {
        Log.error('httpserver.task.run.error', e)
        res.status(500).json({code: -1, msg: String(e)})
    }
})

app.post('/api/task/history', async (req, res) => {
    try {
        const id = req.body?.id
        if (!id) {
            res.status(400).json({code: -1, msg: 'Missing task id'})
            return
        }
        const runs = await DBMain.select(
            `SELECT id, task_id, device_id, status, log, started_at, finished_at, created_at, updated_at
             FROM task_run WHERE task_id = ? ORDER BY id DESC LIMIT 50`,
            [id],
        )
        res.json({code: 0, data: runs})
    } catch (e: any) {
        Log.error('httpserver.task.runs.error', e)
        res.status(500).json({code: -1, msg: String(e)})
    }
})

// 404 fallback (already behind auth wall)
app.use((_req, res) => {
    res.status(404).json({code: -1, msg: 'Not Found'})
})

// ── Lifecycle ──────────────────────────────────────────────────────────────

const start = async (): Promise<number> => {
    if (server) {
        return runningPort
    }

    runningPort = await Apps.availablePort(53030, 'httpserver', 60)
    runningToken = generateToken()

    await new Promise<void>((resolve, reject) => {
        server = app.listen(runningPort, '127.0.0.1', () => resolve())
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
