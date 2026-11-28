/**
 * AI code-change history.
 *
 * One directory per task under `<dataRoot>/ai-history/<uuid>/`:
 *   - index.json       version metadata + the user's read position
 *   - v0000.json.gz    compressed version payload (code + line diff + stats)
 *
 * History intentionally lives outside the project directory so zip export,
 * import, the file list and cloud change detection are untouched. It only
 * keeps versions produced by AI (repair / chat) plus manual restores.
 */
import {ipcMain} from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import {AppEnv} from '../env'
import DBMain from '../db/main'
import {Log} from '../log/main'

export type HistorySource = 'baseline' | 'repair' | 'chat' | 'restore'

export type HistoryDiffLine = {
    type: 'same' | 'add' | 'remove'
    text: string
}

export type HistoryStats = {
    added: number
    removed: number
}

export type HistoryVersionMeta = {
    seq: number
    at: string
    source: HistorySource
    sessionId: number
    refId: string
    taskName: string
    added: number
    removed: number
    /** Compressed payload size in bytes. */
    size: number
}

export type HistoryIndex = {
    uuid: string
    readSeq: number
    versions: HistoryVersionMeta[]
}

export type HistoryRecordInput = {
    uuid: string
    taskName?: string
    source: 'repair' | 'chat' | 'restore'
    sessionId?: number
    refId?: string
    previousCode: string
    nextCode: string
    diff: HistoryDiffLine[]
    stats: HistoryStats
}

export type HistoryVersionPayload = {
    seq: number
    at: string
    source: HistorySource
    sessionId: number
    refId: string
    taskName: string
    code: string
    diff: HistoryDiffLine[]
    stats: HistoryStats
}

const KEEP_VERSIONS = 50
const MAX_BYTES = 20 * 1024 * 1024
const UUID_RE = /^[a-zA-Z0-9][a-zA-Z0-9_-]{7,63}$/
const VERSION_RE = /^v(\d{4,})\.json\.gz$/

const root = () => path.join(AppEnv.dataRoot || '', 'ai-history')
const dirOf = (uuid: string) => path.join(root(), uuid)
const indexPath = (uuid: string) => path.join(dirOf(uuid), 'index.json')
const versionPath = (uuid: string, seq: number) => path.join(dirOf(uuid), `v${String(seq).padStart(4, '0')}.json.gz`)

const assertUuid = (uuid: string) => {
    if (!UUID_RE.test(uuid || '')) {
        throw new Error('InvalidTaskUuid')
    }
}

const nowISO = () => new Date().toISOString()

const readJson = <T>(file: string): T | null => {
    try {
        if (!fs.existsSync(file)) return null
        return JSON.parse(fs.readFileSync(file, 'utf8')) as T
    } catch (e: any) {
        Log.error('AiHistory.ReadJsonFailed', {file, message: String(e?.message || e)})
        return null
    }
}

const writeAtomic = (file: string, data: string | Buffer) => {
    fs.mkdirSync(path.dirname(file), {recursive: true})
    const tmp = `${file}.tmp`
    fs.writeFileSync(tmp, data)
    fs.renameSync(tmp, file)
}

const writeIndex = (index: HistoryIndex) => {
    index.versions.sort((a, b) => a.seq - b.seq)
    writeAtomic(indexPath(index.uuid), JSON.stringify(index, null, 2))
}

const readIndex = (uuid: string): HistoryIndex => {
    const index = readJson<HistoryIndex>(indexPath(uuid))
    if (!index || !Array.isArray(index.versions)) {
        return {uuid, readSeq: 0, versions: []}
    }
    index.uuid = uuid
    index.readSeq = Number(index.readSeq || 0)
    index.versions = index.versions
        .filter((item) => item && Number.isFinite(Number(item.seq)))
        .sort((a, b) => a.seq - b.seq)
    return index
}

const gzip = (payload: unknown) => zlib.gzipSync(Buffer.from(JSON.stringify(payload), 'utf8'))

/** Serialize index updates per task so a repair and a chat edit cannot lose a version. */
const locks = new Map<string, Promise<any>>()
const withLock = async <T>(uuid: string, fn: () => Promise<T>): Promise<T> => {
    const previous = locks.get(uuid) || Promise.resolve()
    const next = previous.then(fn, fn)
    locks.set(
        uuid,
        next.then(
            () => {},
            () => {},
        ),
    )
    return next
}

const writeVersion = (uuid: string, payload: HistoryVersionPayload): number => {
    const buffer = gzip(payload)
    writeAtomic(versionPath(uuid, payload.seq), buffer)
    return buffer.length
}

const readVersion = (uuid: string, seq: number): HistoryVersionPayload | null => {
    try {
        const file = versionPath(uuid, seq)
        if (!fs.existsSync(file)) return null
        return JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString('utf8')) as HistoryVersionPayload
    } catch (e: any) {
        Log.error('AiHistory.ReadVersionFailed', {uuid, seq, message: String(e?.message || e)})
        return null
    }
}

const removeVersionFile = (uuid: string, seq: number) => {
    try {
        fs.rmSync(versionPath(uuid, seq), {force: true})
    } catch {}
}

/** Keep the newest KEEP_VERSIONS versions and stay under MAX_BYTES. */
const prune = (uuid: string, index: HistoryIndex) => {
    const total = () => index.versions.reduce((sum, item) => sum + Number(item.size || 0), 0)
    while (index.versions.length > 1 && (index.versions.length > KEEP_VERSIONS || total() > MAX_BYTES)) {
        const oldest = index.versions.shift()
        if (!oldest) break
        removeVersionFile(uuid, oldest.seq)
    }
}

const record = async (input: HistoryRecordInput): Promise<{seq: number; at: string} | null> => {
    assertUuid(input.uuid)
    const previousCode = String(input.previousCode ?? '')
    const nextCode = String(input.nextCode ?? '')
    if (!nextCode || previousCode === nextCode) return null
    return withLock(input.uuid, async () => {
        fs.mkdirSync(dirOf(input.uuid), {recursive: true})
        const index = readIndex(input.uuid)
        const at = nowISO()
        const taskName = String(input.taskName || '')
        if (index.versions.length === 0) {
            const baseline: HistoryVersionPayload = {
                seq: 0,
                at,
                source: 'baseline',
                sessionId: 0,
                refId: '',
                taskName,
                code: previousCode,
                diff: [],
                stats: {added: 0, removed: 0},
            }
            const size = writeVersion(input.uuid, baseline)
            index.versions.push({
                seq: 0,
                at,
                source: 'baseline',
                sessionId: 0,
                refId: '',
                taskName,
                added: 0,
                removed: 0,
                size,
            })
        }
        const seq = Math.max(...index.versions.map((item) => item.seq), 0) + 1
        const payload: HistoryVersionPayload = {
            seq,
            at,
            source: input.source,
            sessionId: Number(input.sessionId || 0),
            refId: String(input.refId || ''),
            taskName,
            code: nextCode,
            diff: Array.isArray(input.diff) ? input.diff : [],
            stats: {
                added: Number(input.stats?.added || 0),
                removed: Number(input.stats?.removed || 0),
            },
        }
        const size = writeVersion(input.uuid, payload)
        index.versions.push({
            seq,
            at,
            source: payload.source,
            sessionId: payload.sessionId,
            refId: payload.refId,
            taskName,
            added: payload.stats.added,
            removed: payload.stats.removed,
            size,
        })
        prune(input.uuid, index)
        writeIndex(index)
        Log.info('AiHistory.Recorded', {uuid: input.uuid, seq, source: input.source})
        return {seq, at}
    })
}

const list = async (uuid: string): Promise<{readSeq: number; versions: HistoryVersionMeta[]}> => {
    assertUuid(uuid)
    const index = readIndex(uuid)
    return {
        readSeq: index.readSeq,
        versions: [...index.versions].sort((a, b) => b.seq - a.seq),
    }
}

const read = async (uuid: string, seq: number): Promise<HistoryVersionPayload | null> => {
    assertUuid(uuid)
    return readVersion(uuid, Number(seq))
}

const markRead = async (uuid: string, seq?: number): Promise<void> => {
    assertUuid(uuid)
    return withLock(uuid, async () => {
        const index = readIndex(uuid)
        if (!index.versions.length) return
        const latest = Math.max(...index.versions.map((item) => item.seq))
        index.readSeq = Math.max(Number(seq ?? latest), index.readSeq)
        writeIndex(index)
    })
}

const summaries = async (): Promise<
    Record<string, {unread: number; total: number; latestAt: string; latestSource: HistorySource}>
> => {
    const result: Record<string, {unread: number; total: number; latestAt: string; latestSource: HistorySource}> = {}
    const dir = root()
    if (!dir || !fs.existsSync(dir)) return result
    for (const item of fs.readdirSync(dir, {withFileTypes: true})) {
        if (!item.isDirectory() || !UUID_RE.test(item.name)) continue
        const index = readIndex(item.name)
        if (!index.versions.length) continue
        const latest = index.versions[index.versions.length - 1]
        result[item.name] = {
            unread: index.versions.filter(
                (version) => version.seq > index.readSeq && (version.source === 'repair' || version.source === 'chat'),
            ).length,
            total: index.versions.length,
            latestAt: latest.at,
            latestSource: latest.source,
        }
    }
    return result
}

const remove = async (uuid: string): Promise<void> => {
    if (!UUID_RE.test(uuid || '')) return
    return withLock(uuid, async () => {
        try {
            fs.rmSync(dirOf(uuid), {recursive: true, force: true})
        } catch (e: any) {
            Log.error('AiHistory.RemoveFailed', {uuid, message: String(e?.message || e)})
        }
    })
}

let initPromise: Promise<void> | null = null

/** Drop history directories whose task no longer exists. */
const init = async (): Promise<void> => {
    if (!initPromise) {
        initPromise = (async () => {
            if (!AppEnv.dataRoot) return
            const dir = root()
            fs.mkdirSync(dir, {recursive: true})
            const rows: any[] = await DBMain.select('SELECT uuid FROM task')
            const alive = new Set((rows || []).map((row) => String(row.uuid || '')).filter(Boolean))
            for (const item of fs.readdirSync(dir, {withFileTypes: true})) {
                if (!item.isDirectory() || !UUID_RE.test(item.name)) continue
                if (!alive.has(item.name)) {
                    fs.rmSync(path.join(dir, item.name), {recursive: true, force: true})
                    continue
                }
                await tidy(item.name)
            }
            Log.info('AiHistory.Init', {tasks: alive.size})
        })().catch((e) => {
            initPromise = null
            Log.error('AiHistory.InitFailed', {message: String(e?.message || e)})
            throw e
        })
    }
    return initPromise
}

/** Remove leftover *.tmp files and version files missing from the index. */
const tidy = async (uuid: string): Promise<void> => {
    assertUuid(uuid)
    const dir = dirOf(uuid)
    if (!fs.existsSync(dir)) return
    const index = readIndex(uuid)
    const keep = new Set(index.versions.map((item) => path.basename(versionPath(uuid, item.seq))))
    for (const name of fs.readdirSync(dir)) {
        if (VERSION_RE.test(name) && !keep.has(name)) {
            fs.rmSync(path.join(dir, name), {force: true})
        } else if (name.endsWith('.tmp')) {
            fs.rmSync(path.join(dir, name), {force: true})
        }
    }
}

// ── IPC ──

ipcMain.handle('history:record', async (_, input: HistoryRecordInput) => record(input))
ipcMain.handle('history:list', async (_, uuid: string) => list(uuid))
ipcMain.handle('history:read', async (_, uuid: string, seq: number) => read(uuid, seq))
ipcMain.handle('history:markRead', async (_, uuid: string, seq?: number) => markRead(uuid, seq))
ipcMain.handle('history:summaries', async () => summaries())
ipcMain.handle('history:remove', async (_, uuid: string) => remove(uuid))
ipcMain.handle('history:tidy', async (_, uuid: string) => tidy(uuid))

export const AiHistory = {
    init,
    record,
    list,
    read,
    markRead,
    summaries,
    remove,
    tidy,
    root,
}

export default AiHistory
