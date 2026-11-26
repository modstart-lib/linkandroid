/**
 * Task project storage.
 *
 * Every task owns a directory under `<dataRoot>/projects/<uuid>/`:
 *   - linkandroid.json  manifest with task basics / run settings / cloud link
 *   - main.py           entry file (single source of truth for the code)
 * Any other file in the directory is kept and travels with zip export/import.
 *
 * The SQLite `task` row stays the latest snapshot used by the UI, scheduler
 * and run history, and is kept in sync by this module.
 */
import {ipcMain, shell} from 'electron'
import * as crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import {AppEnv} from '../env'
import {Log} from '../log/main'
import DBMain from '../db/main'
import {OpenCodeAgent} from '../opencode-agent/main'
import Misc from '../misc/index'

export type ProjectManifest = {
    uuid: string
    name: string
    description: string
    requirement: string
    language: string
    entry: string
    runMode: string
    cronExpression: string
    deviceIds: string[]
    runOnAllDevices: boolean
    autoRepair: boolean
    createdAt: string
    updatedAt: string
    
}

export type ProjectSaveData = {
    id?: number
    name: string
    description?: string
    requirement?: string
    code: string
    language?: string
    runMode?: string
    cronExpression?: string
    deviceIds?: string[]
    runOnAllDevices?: boolean
    autoRepair?: boolean
    /** Copy the remaining files of this project when creating a new task. */
    copyFromId?: number
}

const DEFAULT_ENTRY = 'main.py'
const MANIFEST_FILE = 'linkandroid.json'
const UUID_RE = /^[a-zA-Z0-9][a-zA-Z0-9_-]{7,63}$/
const MAX_FILE_BYTES = 5 * 1024 * 1024
const MAX_IMPORT_ENTRIES = 2000
const MAX_IMPORT_ZIP_BYTES = 50 * 1024 * 1024

export type TaskImportResult =
    | {ok: true; id: number; name: string; overwritten: boolean}
    | {ok: false; code: 'NameExists'; name: string}

export type TaskImportPreview = {path: string; name: string; exists: boolean; error?: string}

export type TaskExportAllResult = {
    exported: number
    failed: Array<{name: string; error: string}>
}

const root = () => path.join(AppEnv.dataRoot, 'projects')
const projectDir = (uuid: string) => path.join(root(), uuid)
const manifestPath = (uuid: string) => path.join(projectDir(uuid), 'linkandroid.json')

const nowISO = () => new Date().toISOString()

const assertUuid = (uuid: string) => {
    if (!UUID_RE.test(uuid || '')) {
        throw new Error('InvalidProjectUuid')
    }
}

/** Resolve a path inside a project directory, rejecting every escape attempt. */
const safeJoin = (uuid: string, relPath: string) => {
    assertUuid(uuid)
    const base = projectDir(uuid)
    const target = path.resolve(base, relPath || '.')
    if (target !== base && !target.startsWith(base + path.sep)) {
        throw new Error('PathOutOfProject')
    }
    return target
}

const ensureDirs = () => {
    const dir = root()
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, {recursive: true})
    }
}



const buildManifest = (row: any, code: string, old?: ProjectManifest | null): ProjectManifest => ({
    uuid: row.uuid,
    name: row.name || '',
    description: row.description || '',
    requirement: row.requirement || '',
    language: row.language || 'python',
    entry: old?.entry || DEFAULT_ENTRY,
    runMode: row.run_mode || 'manual',
    cronExpression: row.cron_expression || '',
    deviceIds: String(row.device_ids || '')
        .split(',')
        .map((v) => v.trim())
        .filter((v) => v.length > 0),
    runOnAllDevices: Number(row.run_on_all_devices || 0) === 1,
    autoRepair: Number(row.auto_repair ?? 1) !== 0,
    createdAt: old?.createdAt || row.created_at || nowISO(),
    updatedAt: row.updated_at || nowISO(),
    
})

const readManifest = (uuid: string): ProjectManifest | null => {
    try {
        const file = manifestPath(uuid)
        if (!fs.existsSync(file)) return null
        return JSON.parse(fs.readFileSync(file, 'utf8')) as ProjectManifest
    } catch (e: any) {
        Log.error('Project.ReadManifestFailed', {uuid, message: String(e?.message || e)})
        return null
    }
}

const writeManifest = (uuid: string, manifest: ProjectManifest) => {
    assertUuid(uuid)
    fs.mkdirSync(projectDir(uuid), {recursive: true})
    fs.writeFileSync(manifestPath(uuid), JSON.stringify(manifest, null, 4))
}

const writeEntry = (uuid: string, entry: string, code: string) => {
    const file = safeJoin(uuid, entry || DEFAULT_ENTRY)
    fs.mkdirSync(path.dirname(file), {recursive: true})
    fs.writeFileSync(file, code ?? '')
}

const readEntry = (uuid: string, entry?: string): string => {
    try {
        const file = safeJoin(uuid, entry || DEFAULT_ENTRY)
        if (!fs.existsSync(file)) return ''
        return fs.readFileSync(file, 'utf8')
    } catch {
        return ''
    }
}

const removeDir = (dir: string) => {
    if (fs.existsSync(dir)) {
        fs.rmSync(dir, {recursive: true, force: true})
    }
}

const getRow = async (id?: number, uuid?: string): Promise<any> => {
    if (id) {
        return await DBMain.first('SELECT * FROM task WHERE id = ?', [id])
    }
    if (uuid) {
        return await DBMain.first('SELECT * FROM task WHERE uuid = ?', [uuid])
    }
    return null
}

const snapshotValues = (row: any) => [
    row.uuid,
    
]

/** Write the directory for a task row; creates the manifest when missing. */
const writeProjectFiles = (row: any, code: string) => {
    assertUuid(row.uuid)
    const dir = projectDir(row.uuid)
    fs.mkdirSync(dir, {recursive: true})
    const manifest = buildManifest(row, code, readManifest(row.uuid))
    writeManifest(row.uuid, manifest)
    writeEntry(row.uuid, manifest.entry, code)
    return manifest
}

const save = async (data: ProjectSaveData): Promise<any> => {
    ensureDirs()
    const name = (data.name || '').trim()
    if (!name) {
        throw new Error('TaskNameRequired')
    }
    const now = nowISO()
    const code = data.code ?? ''
    const language = data.language || 'python'
    if (data.id && data.id > 0) {
        const row = await getRow(Number(data.id))
        if (!row) throw new Error('TaskNotFound')
        const uuid = row.uuid || crypto.randomUUID()
        const next = {
            ...row,
            uuid,
            name,
            description: data.description ?? row.description ?? '',
            requirement: data.requirement ?? row.requirement ?? '',
            language,
            run_mode: data.runMode ?? row.run_mode ?? 'manual',
            cron_expression: data.cronExpression ?? row.cron_expression ?? '',
            device_ids: data.deviceIds === undefined ? row.device_ids || '' : data.deviceIds.join(','),
            run_on_all_devices:
                data.runOnAllDevices === undefined ? row.run_on_all_devices || 0 : data.runOnAllDevices ? 1 : 0,
            auto_repair: data.autoRepair === undefined ? (row.auto_repair ?? 1) : data.autoRepair ? 1 : 0,
            updated_at: now,
        }
        const manifest = writeProjectFiles(next, code)
        await DBMain.update(
            `UPDATE task SET uuid = ?, name = ?, description = ?, requirement = ?, code = ?, language = ?,
             run_mode = ?, cron_expression = ?, device_ids = ?, run_on_all_devices = ?, auto_repair = ?, updated_at = ? WHERE id = ?`,
            [
                manifest.uuid,
                name,
                next.description,
                next.requirement,
                code,
                language,
                next.run_mode,
                next.cron_expression,
                next.device_ids,
                next.run_on_all_devices,
                next.auto_repair,
                now,
                next.id,
            ],
        )
        return await getRow(next.id)
    }
    const uuid = crypto.randomUUID()
    const row = {
        uuid,
        name,
        description: data.description || '',
        requirement: data.requirement || '',
        code,
        language,
        run_mode: data.runMode || 'manual',
        cron_expression: data.cronExpression || '',
        device_ids: (data.deviceIds || []).join(','),
        run_on_all_devices: data.runOnAllDevices ? 1 : 0,
        auto_repair: data.autoRepair === false ? 0 : 1,
        created_at: now,
        updated_at: now,
    }
    writeProjectFiles(row, code)
    if (data.copyFromId) {
        // Copy the rest of the source project (extra files) into the new project.
        const sourceRow = await getRow(Number(data.copyFromId))
        const sourceDir = sourceRow?.uuid ? projectDir(sourceRow.uuid) : ''
        if (sourceDir && fs.existsSync(sourceDir)) {
            fs.cpSync(sourceDir, projectDir(uuid), {
                recursive: true,
                filter: (src) => !/__pycache__|\.git$|node_modules/.test(src),
            })
            // Rewrite manifest + entry so the copy carries the new identity and no cloud link.
            writeProjectFiles(row, code)
        }
    }
    const id = await DBMain.insert(
        `INSERT INTO task (created_at, updated_at, uuid, name, description, requirement, code, language,
         run_mode, cron_expression, device_ids, run_on_all_devices, auto_repair)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            row.created_at,
            row.updated_at,
            uuid,
            name,
            row.description,
            row.requirement,
            code,
            language,
            row.run_mode,
            row.cron_expression,
            row.device_ids,
            row.run_on_all_devices,
            row.auto_repair,
        ],
    )
    Log.info('Project.Created', {id, uuid})
    return await getRow(Number(id))
}

const remove = async (id: number) => {
    const row = await getRow(Number(id))
    if (!row) return
    if (row.uuid) {
        removeDir(projectDir(row.uuid))
        // Task-scoped AI conversations live in the app DB and the OpenCode DB.
        const sessions: any[] = await DBMain.select('SELECT id FROM agent_chat_session WHERE business_id = ?', [
            row.uuid,
        ])
        for (const session of sessions || []) {
            const dir = path.join(AppEnv.dataRoot || process.cwd(), 'chat-images', String(session.id))
            try {
                fs.rmSync(dir, {recursive: true, force: true})
            } catch {}
        }
        await DBMain.delete(
            'DELETE FROM agent_chat_message WHERE session_id IN (SELECT id FROM agent_chat_session WHERE business_id = ?)',
            [row.uuid],
        )
        await DBMain.delete('DELETE FROM agent_chat_session WHERE business_id = ?', [row.uuid])
        await OpenCodeAgent.sessionRemoveBusiness(['task-chat', 'task-repair'], row.uuid).catch(() => {})
    }
    await DBMain.delete('DELETE FROM task_run WHERE task_id = ?', [Number(id)])
    await DBMain.delete('DELETE FROM task WHERE id = ?', [Number(id)])
    Log.info('Project.Removed', {id, uuid: row.uuid})
}

const copy = async (id: number): Promise<any> => {
    const row = await getRow(Number(id))
    if (!row) throw new Error('TaskNotFound')
    const sourceDir = row.uuid ? projectDir(row.uuid) : ''
    const manifest = row.uuid ? readManifest(row.uuid) : null
    const entry = manifest?.entry || DEFAULT_ENTRY
    const saved = await save({
        name: `${row.name} 副本`,
        description: row.description || '',
        requirement: row.requirement || '',
        code: row.code || '',
        language: row.language || 'python',
        runMode: row.run_mode || 'manual',
        cronExpression: row.cron_expression || '',
        deviceIds: String(row.device_ids || '')
            .split(',')
            .map((v) => v.trim())
            .filter((v) => v.length > 0),
        runOnAllDevices: Number(row.run_on_all_devices || 0) === 1,
        autoRepair: Number(row.auto_repair ?? 1) !== 0,
    })
    if (sourceDir && fs.existsSync(sourceDir) && saved?.uuid) {
        // Keep every extra file of the source project, not only the entry.
        const targetDir = projectDir(saved.uuid)
        fs.cpSync(sourceDir, targetDir, {
            recursive: true,
            filter: (src) => !/__pycache__|\.git$|node_modules/.test(src),
        })
        const copied = readManifest(saved.uuid)
        if (copied) {
            copied.uuid = saved.uuid
            copied.name = saved.name
            copied.entry = entry
            copied.createdAt = saved.created_at
            copied.updatedAt = saved.updated_at
            
            writeManifest(saved.uuid, copied)
        }
        writeEntry(saved.uuid, entry, saved.code || '')
        
    }
    return await getRow(saved.id)
}

const localPathInfo = async (id: number) => {
    const row = await getRow(Number(id))
    if (!row || !row.uuid) return {id: Number(id), dir: '', entry: '', exists: false}
    const manifest = readManifest(row.uuid)
    const entry = manifest?.entry || DEFAULT_ENTRY
    const dir = projectDir(row.uuid)
    const entryFile = safeJoin(row.uuid, entry)
    return {id: Number(id), uuid: row.uuid, dir, entry, exists: fs.existsSync(entryFile)}
}

const listFiles = async (id: number) => {
    const info = await localPathInfo(id)
    const files: Array<{path: string; size: number; isDir: boolean; updatedAt: string}> = []
    if (!info.dir || !fs.existsSync(info.dir)) return files
    const walk = (dir: string, prefix: string) => {
        if (files.length >= MAX_IMPORT_ENTRIES) return
        for (const item of fs.readdirSync(dir)) {
            const full = path.join(dir, item)
            const rel = prefix ? `${prefix}/${item}` : item
            const stat = fs.statSync(full)
            if (stat.isDirectory()) {
                if (/^(__pycache__|\.git|node_modules)$/.test(item)) continue
                files.push({path: rel, size: 0, isDir: true, updatedAt: stat.mtime.toISOString()})
                walk(full, rel)
            } else {
                files.push({path: rel, size: stat.size, isDir: false, updatedAt: stat.mtime.toISOString()})
            }
        }
    }
    walk(info.dir, '')
    return files
}

const readFile = async (id: number, relPath: string) => {
    const info = await localPathInfo(id)
    if (!info.uuid) throw new Error('TaskNotFound')
    const file = safeJoin(info.uuid, relPath)
    if (!fs.existsSync(file) || fs.statSync(file).size > MAX_FILE_BYTES) {
        throw new Error('FileUnreadable')
    }
    return fs.readFileSync(file, 'utf8')
}

const writeFile = async (id: number, relPath: string, content: string) => {
    const info = await localPathInfo(id)
    if (!info.uuid) throw new Error('TaskNotFound')
    if (!relPath || relPath === 'linkandroid.json') throw new Error('FileProtected')
    const file = safeJoin(info.uuid, relPath)
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
        throw new Error('PathIsDirectory')
    }
    fs.mkdirSync(path.dirname(file), {recursive: true})
    if (Buffer.byteLength(content ?? '', 'utf8') > MAX_FILE_BYTES) {
        throw new Error('FileTooLarge')
    }
    fs.writeFileSync(file, content ?? '')
    const now = nowISO()
    await DBMain.update('UPDATE task SET code = CASE WHEN ? = 1 THEN ? ELSE code END, updated_at = ? WHERE id = ?', [
        relPath === info.entry ? 1 : 0,
        content ?? '',
        now,
        Number(id),
    ])
    const manifest = readManifest(info.uuid)
    if (manifest) {
        manifest.updatedAt = now
        writeManifest(info.uuid, manifest)
    }
}

const renameFile = async (id: number, fromPath: string, toPath: string) => {
    const info = await localPathInfo(id)
    if (!info.uuid) throw new Error('TaskNotFound')
    if (!fromPath || !toPath || fromPath === info.entry || toPath === info.entry) {
        throw new Error('EntryFileProtected')
    }
    if (fromPath === 'linkandroid.json' || toPath === 'linkandroid.json') {
        throw new Error('FileProtected')
    }
    const from = safeJoin(info.uuid, fromPath)
    const to = safeJoin(info.uuid, toPath)
    if (!fs.existsSync(from)) throw new Error('FileNotFound')
    if (fs.existsSync(to)) throw new Error('FileExists')
    fs.mkdirSync(path.dirname(to), {recursive: true})
    fs.renameSync(from, to)
    const manifest = readManifest(info.uuid)
    if (manifest) {
        manifest.updatedAt = nowISO()
        writeManifest(info.uuid, manifest)
    }
}

const deleteFile = async (id: number, relPath: string) => {
    const info = await localPathInfo(id)
    if (!info.uuid) throw new Error('TaskNotFound')
    if (!relPath || relPath === info.entry || relPath === 'linkandroid.json') {
        throw new Error('EntryFileProtected')
    }
    const file = safeJoin(info.uuid, relPath)
    if (fs.existsSync(file)) {
        fs.rmSync(file, {recursive: true, force: true})
    }
    const manifest = readManifest(info.uuid)
    if (manifest) {
        manifest.updatedAt = nowISO()
        writeManifest(info.uuid, manifest)
    }
}

const openDir = async (id: number) => {
    const info = await localPathInfo(id)
    if (!info.dir) throw new Error('TaskNotFound')
    fs.mkdirSync(info.dir, {recursive: true})
    return await shell.openPath(info.dir)
}

const zipFilter = ({path: relPath, name, isDir}: {path: string; name: string; isDir: boolean}) => {
    if (/^(__pycache__|\.git|node_modules|\.venv|_aienv)$/.test(name)) return false
    if (/\.pyc$/i.test(relPath)) return false
    if (isDir && /\/\.cache$/.test(relPath)) return false
    return true
}

const zipProjectToTemp = async (dir: string): Promise<{file: string; size: number}> => {
    const tmp = path.join(root(), `.export-${crypto.randomUUID()}.zip`)
    try {
        await Misc.zip(tmp, dir, {
            filter: async (params: any) => zipFilter(params),
        })
        return {file: tmp, size: fs.statSync(tmp).size}
    } catch (e) {
        removeDir(tmp)
        throw e
    }
}

const detectZipRoot = (dir: string): string => {
    const items = fs.readdirSync(dir, {withFileTypes: true})
    if (items.length === 1 && items[0].isDirectory()) {
        const nested = path.join(dir, items[0].name)
        if (fs.existsSync(path.join(nested, MANIFEST_FILE)) || fs.existsSync(path.join(nested, DEFAULT_ENTRY))) {
            return nested
        }
    }
    return dir
}

function readManifestFrom(dir: string): ProjectManifest | null {
    try {
        const file = path.join(dir, MANIFEST_FILE)
        if (!fs.existsSync(file)) return null
        return JSON.parse(fs.readFileSync(file, 'utf8'))
    } catch {
        return null
    }
}

/** File-name-safe task title, used for exported zip names. */
const safeFileBaseName = (name: string, fallback: string) => {
    const value = String(name || '')
        .replace(/[\\/:*?"<>|\r\n\t]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/^\.+/, '')
        .slice(0, 80)
        .trim()
    return value || fallback
}

const uniqueZipPath = (dir: string, name: string, fallback: string) => {
    const base = safeFileBaseName(name, fallback)
    let target = path.join(dir, `${base}.zip`)
    let index = 2
    while (fs.existsSync(target)) {
        target = path.join(dir, `${base} (${index}).zip`)
        index++
    }
    return target
}

const normalizeTaskName = (name: string) => {
    return String(name || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 100)
}

/** Entry path declared by an imported manifest; reject escapes and fall back to main.py. */
const normalizeEntry = (entry?: string) => {
    const rel = String(entry || DEFAULT_ENTRY).replace(/\\/g, '/')
    if (!rel || rel.startsWith('/') || /^[a-zA-Z]:/.test(rel) || rel.split('/').some((s) => s === '..')) {
        return DEFAULT_ENTRY
    }
    return rel
}

/** Replace the project directory content with the imported package (manifest is kept). */
const replaceProjectFiles = (srcDir: string, destDir: string) => {
    fs.mkdirSync(destDir, {recursive: true})
    for (const item of fs.readdirSync(destDir)) {
        if (item === MANIFEST_FILE) continue
        fs.rmSync(path.join(destDir, item), {recursive: true, force: true})
    }
    for (const item of fs.readdirSync(srcDir)) {
        if (item === MANIFEST_FILE) continue
        fs.cpSync(path.join(srcDir, item), path.join(destDir, item), {recursive: true})
    }
}

const exportToFile = async (id: number, targetPath: string): Promise<{path: string; size: number}> => {
    const info = await localPathInfo(id)
    if (!info.dir || !fs.existsSync(info.dir)) throw new Error('ProjectDirMissing')
    let target = String(targetPath || '')
    if (!target) throw new Error('ExportPathRequired')
    if (path.extname(target).toLowerCase() !== '.zip') {
        target = `${target}.zip`
    }
    const resolved = path.resolve(target)
    const rel = path.relative(path.resolve(info.dir), resolved)
    if (!rel || (!rel.startsWith('..') && !path.isAbsolute(rel))) {
        // packing into the project folder would archive the archive itself
        throw new Error('ExportPathInProject')
    }
    fs.mkdirSync(path.dirname(resolved), {recursive: true})
    const packed = await zipProjectToTemp(info.dir)
    try {
        fs.copyFileSync(packed.file, resolved)
        return {path: resolved, size: packed.size}
    } finally {
        removeDir(packed.file)
    }
}

const exportAllTo = async (dir: string): Promise<TaskExportAllResult> => {
    const targetDir = String(dir || '')
    if (!targetDir) throw new Error('ExportPathRequired')
    fs.mkdirSync(targetDir, {recursive: true})
    const rows: any[] = await DBMain.select('SELECT id, name, uuid FROM task ORDER BY updated_at DESC')
    const result: TaskExportAllResult = {exported: 0, failed: []}
    for (const row of rows) {
        const info = await localPathInfo(row.id)
        if (!info.dir || !fs.existsSync(info.dir)) {
            result.failed.push({name: row.name, error: 'ProjectDirMissing'})
            continue
        }
        const target = uniqueZipPath(targetDir, row.name, info.uuid || String(row.id))
        try {
            await exportToFile(row.id, target)
            result.exported++
        } catch (e: any) {
            result.failed.push({name: row.name, error: String(e?.message || e)})
        }
    }
    return result
}

type ZipPackage = {
    manifest: ProjectManifest | null
    entry: string
    code: string
}

/** Validate and unpack a task package into a temp directory; the caller must remove tmpRoot. */
const extractZipPackage = async (zipPath: string): Promise<{tmpRoot: string; src: string; pkg: ZipPackage}> => {
    const file = String(zipPath || '')
    if (!file || !fs.existsSync(file)) throw new Error('FileNotFound')
    if (fs.statSync(file).size > MAX_IMPORT_ZIP_BYTES) throw new Error('ZipTooLarge')
    const fd = fs.openSync(file, 'r')
    const magic = Buffer.alloc(2)
    try {
        fs.readSync(fd, magic, 0, 2, 0)
    } finally {
        fs.closeSync(fd)
    }
    if (magic[0] !== 0x50 || magic[1] !== 0x4b) throw new Error('ZipInvalid')
    ensureDirs()
    const tmpRoot = path.join(root(), `.import-${crypto.randomUUID()}`)
    const tmpDir = path.join(tmpRoot, 'content')
    fs.mkdirSync(tmpDir, {recursive: true})
    try {
        await Misc.unzip(file, tmpDir)
    } catch (e) {
        removeDir(tmpRoot)
        throw e
    }
    const src = detectZipRoot(tmpDir)
    const manifest = readManifestFrom(src)
    const entry = normalizeEntry(manifest?.entry)
    const entryFile = path.join(src, entry)
    const code = fs.existsSync(entryFile) && fs.statSync(entryFile).isFile() ? fs.readFileSync(entryFile, 'utf8') : ''
    return {tmpRoot, src, pkg: {manifest, entry, code}}
}

const packageTaskName = (pkg: ZipPackage, file: string) => {
    return (
        normalizeTaskName(pkg.manifest?.name || '') ||
        normalizeTaskName(path.basename(file).replace(/\.zip$/i, '')) ||
        '导入的任务'
    )
}

const previewImport = async (zipPaths: string[]): Promise<TaskImportPreview[]> => {
    const list: TaskImportPreview[] = []
    for (const file of zipPaths || []) {
        let extracted: {tmpRoot: string; src: string; pkg: ZipPackage} | null = null
        try {
            extracted = await extractZipPackage(file)
            const name = packageTaskName(extracted.pkg, file)
            const rows: any[] = await DBMain.select('SELECT id FROM task WHERE name = ?', [name])
            list.push({path: file, name, exists: !!(rows && rows.length)})
        } catch (e: any) {
            list.push({
                path: file,
                name: path.basename(String(file || '')),
                exists: false,
                error: String(e?.message || e),
            })
        } finally {
            if (extracted) removeDir(extracted.tmpRoot)
        }
    }
    return list
}

/**
 * Import a task package produced by exportToFile.
 * A task with the same name is replaced only when overwrite is set; its id and uuid stay,
 * and a "副本" backup is made first (same rule as cloud sync).
 */
const importFromFile = async (zipPath: string, overwrite: boolean = false): Promise<TaskImportResult> => {
    const file = String(zipPath || '')
    const extracted = await extractZipPackage(file)
    try {
        const {src, pkg} = extracted
        const name = packageTaskName(pkg, file)
        const rows: any[] = await DBMain.select('SELECT * FROM task WHERE name = ?', [name])
        const existing = rows && rows[0] ? rows[0] : null
        if (existing && !overwrite) {
            return {ok: false, code: 'NameExists', name}
        }
        if (existing) {
            await copy(existing.id)
        }
        const saved = await save({
            id: existing?.id,
            name,
            description: pkg.manifest?.description || '',
            requirement: pkg.manifest?.requirement || '',
            code: pkg.code,
            language: pkg.manifest?.language || 'python',
            // imported tasks always start as manual runs on this machine
            runMode: 'manual',
            cronExpression: '',
            deviceIds: [],
            runOnAllDevices: false,
            autoRepair: true,
        })
        replaceProjectFiles(src, projectDir(saved.uuid))
        // keep the entry file present even when the package only carried its content
        writeEntry(saved.uuid, pkg.entry, pkg.code)
        const next = readManifest(saved.uuid)
        if (next) {
            next.uuid = saved.uuid
            next.name = saved.name
            next.entry = pkg.entry
            next.runMode = 'manual'
            next.cronExpression = ''
            next.deviceIds = []
            next.runOnAllDevices = false
            next.autoRepair = true
            next.updatedAt = saved.updated_at || nowISO()
            writeManifest(saved.uuid, next)
        }
        Log.info('Project.Imported', {id: saved.id, name: saved.name, overwritten: !!existing, entry: pkg.entry})
        return {ok: true, id: saved.id, name: saved.name, overwritten: !!existing}
    } catch (e: any) {
        Log.error('Project.ImportFileFailed', {file, message: String(e?.message || e)})
        throw e
    } finally {
        removeDir(extracted.tmpRoot)
    }
}



/**
 * Assign uuids to legacy tasks and materialise their project directories.
 * Idempotent; runs once after the database migration on app start.
 */
let migratePromise: Promise<void> | null = null
const ensureMigrated = async (): Promise<void> => {
    if (!migratePromise) {
        migratePromise = (async () => {
            ensureDirs()
            const rows = await DBMain.select('SELECT * FROM task')
            for (const row of rows) {
                let uuid = row.uuid
                if (!uuid) {
                    uuid = crypto.randomUUID()
                    await DBMain.update('UPDATE task SET uuid = ? WHERE id = ?', [uuid, row.id])
                    row.uuid = uuid
                }
                if (!fs.existsSync(manifestPath(uuid)) || !fs.existsSync(path.join(projectDir(uuid), DEFAULT_ENTRY))) {
                    const manifest = readManifest(uuid)
                    writeProjectFiles({...row, uuid}, row.code || '')
                    if (!manifest) {
                        Log.info('Project.Backfill', {id: row.id, uuid})
                    }
                }
            }
            Log.info('Project.Migrated', {count: rows.length})
        })().catch((e) => {
            migratePromise = null
            Log.error('Project.MigrateFailed', {message: String(e?.message || e)})
            throw e
        })
    }
    return migratePromise
}

// ── IPC ──

ipcMain.handle('project:save', async (_, data: ProjectSaveData) => save(data))
ipcMain.handle('project:remove', async (_, id: number) => remove(id))
ipcMain.handle('project:copy', async (_, id: number) => copy(id))
ipcMain.handle('project:path', async (_, id: number) => localPathInfo(id))
ipcMain.handle('project:listFiles', async (_, id: number) => listFiles(id))
ipcMain.handle('project:readFile', async (_, id: number, relPath: string) => readFile(id, relPath))
ipcMain.handle('project:writeFile', async (_, id: number, relPath: string, content: string) =>
    writeFile(id, relPath, content),
)
ipcMain.handle('project:deleteFile', async (_, id: number, relPath: string) => deleteFile(id, relPath))
ipcMain.handle('project:renameFile', async (_, id: number, fromPath: string, toPath: string) =>
    renameFile(id, fromPath, toPath),
)
ipcMain.handle('project:openDir', async (_, id: number) => openDir(id))
ipcMain.handle('project:exportToFile', async (_, id: number, targetPath: string) => exportToFile(id, targetPath))
ipcMain.handle('project:exportAllTo', async (_, dir: string) => exportAllTo(dir))
ipcMain.handle('project:previewImport', async (_, zipPaths: string[]) => previewImport(zipPaths))
ipcMain.handle('project:importFromFile', async (_, zipPath: string, overwrite: boolean) =>
    importFromFile(zipPath, !!overwrite),
)

ipcMain.handle('project:manifest', async (_, id: number) => {
    const info = await localPathInfo(id)
    return info.uuid ? readManifest(info.uuid) : null
})

export const Project = {
    ensureMigrated,
    save,
    remove,
    copy,
    exportToFile,
    exportAllTo,
    previewImport,
    importFromFile,
    
    projectDir,
}

export default Project
