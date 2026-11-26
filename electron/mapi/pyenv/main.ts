/**
 * Per-user Python package overlay.
 *
 * The bundled interpreter and its built-in packages live inside the app bundle,
 * which is read-only once packaged (macOS .app, AppImage, /opt, Program Files).
 * Extra pip packages therefore install into a writable overlay under the data
 * directory, and every task runtime prepends it to PYTHONPATH. The interpreter
 * itself never changes, so moving or updating the app cannot break the overlay.
 */
import {ipcMain, shell} from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import {execFileSync} from 'node:child_process'
import Apps from '../app/index'
import {AppEnv} from '../env'
import {Events} from '../event/main'
import {Log} from '../log/main'
import {isPackaged, platformName} from '../../lib/env'

export type PyenvPackage = {
    name: string
    version: string
    /** Shipped inside the app bundle instead of installed by the user. */
    builtin: boolean
}

export type PyenvInfo = {
    pythonVersion: string
    overlayPath: string
    size: number
    packages: PyenvPackage[]
}

type PyenvProbe = {
    version: string
    tag: string
    /** site-packages of the bundled interpreter. */
    baseSite: string
}

const resourceRoot = () =>
    isPackaged ? process.resourcesPath : AppEnv.appRoot || process.env.APP_ROOT || process.cwd()

const pythonPath = () =>
    path.join(resourceRoot(), 'env', 'task', '_aienv', platformName() === 'win' ? 'Scripts/python.exe' : 'bin/python')

const libPath = () => path.join(resourceRoot(), 'env', 'task', 'lib')

let probeCache: PyenvProbe | null = null

/** Ask the bundled interpreter once for its version, ABI tag and base site-packages. */
const probe = (): PyenvProbe => {
    if (probeCache) return probeCache
    const code = [
        'import json, sys, sysconfig',
        'print(json.dumps({',
        '  "version": sys.version.split()[0],',
        '  "tag": "py%d%d" % sys.version_info[:2],',
        '  "site": sysconfig.get_paths()["purelib"],',
        '}))',
    ].join('\n')
    try {
        const out = execFileSync(pythonPath(), ['-c', code], {encoding: 'utf8', timeout: 15000})
        const data = JSON.parse(out)
        probeCache = {
            version: String(data?.version || ''),
            tag: String(data?.tag || 'py312'),
            baseSite: String(data?.site || ''),
        }
    } catch (e: any) {
        Log.error('Pyenv.ProbeFailed', {message: String(e?.message || e)})
        probeCache = {version: '', tag: 'py312', baseSite: ''}
    }
    return probeCache
}

/**
 * Overlay is keyed by Python ABI tag + platform + arch so a version or arch
 * change never mixes wheels. `process.arch` (x64 / arm64) is used instead of the
 * project's `platformArch()` helper, which reports x64 as "x86".
 */
const overlayRoot = () =>
    path.join(AppEnv.dataRoot || process.cwd(), 'python', `${probe().tag}-${platformName()}-${process.arch}`)

const sitePath = () => path.join(overlayRoot(), 'site-packages')

const cachePath = () => path.join(AppEnv.dataRoot || process.cwd(), 'python', 'cache')

const ensure = () => {
    fs.mkdirSync(sitePath(), {recursive: true})
}

/** Environment every task runtime needs so user-installed packages are importable. */
const buildEnv = () => {
    const sep = path.delimiter
    const env: Record<string, string> = {
        PYTHONPATH: [libPath(), sitePath()].join(sep),
    }
    // Windows resolves compiled-wheel DLLs through PATH, not sys.path.
    if (platformName() === 'win') {
        env.PATH = [sitePath(), path.join(sitePath(), 'Scripts'), process.env.PATH || ''].filter(Boolean).join(sep)
    }
    return env
}

const normalizeName = (name: string) =>
    String(name || '')
        .toLowerCase()
        .replace(/[-_.]/g, '-')

/** Distribution name of a pip requirement such as `pandas==2.2.3`, `numpy>=2`, `pkg[extra]`. */
const requirementName = (requirement: string) =>
    normalizeName(
        String(requirement || '')
            .trim()
            .split(/[=<>!~[;\s]/)[0],
    )

const readPackages = (dir: string, builtin: boolean): PyenvPackage[] => {
    if (!dir || !fs.existsSync(dir)) return []
    const list: PyenvPackage[] = []
    for (const item of fs.readdirSync(dir)) {
        if (!item.endsWith('.dist-info')) continue
        const stem = item.slice(0, -'.dist-info'.length)
        const index = stem.lastIndexOf('-')
        if (index <= 0) continue
        list.push({name: stem.slice(0, index), version: stem.slice(index + 1), builtin})
    }
    return list
}

const dirSize = (dir: string): number => {
    if (!dir || !fs.existsSync(dir)) return 0
    let total = 0
    for (const item of fs.readdirSync(dir)) {
        const file = path.join(dir, item)
        try {
            const stat = fs.lstatSync(file)
            total += stat.isDirectory() ? dirSize(file) : stat.size
        } catch {
            // file vanished mid-walk
        }
    }
    return total
}

const info = (): PyenvInfo => {
    const user = readPackages(sitePath(), false)
    const userNames = new Set(user.map((item) => normalizeName(item.name)))
    const builtin = readPackages(probe().baseSite, true).filter((item) => !userNames.has(normalizeName(item.name)))
    return {
        pythonVersion: probe().version,
        overlayPath: overlayRoot(),
        size: dirSize(overlayRoot()),
        packages: [...builtin, ...user].sort((a, b) => a.name.localeCompare(b.name)),
    }
}

/** Move freshly installed entries into the overlay, replacing older copies entry by entry. */
const mergeDirectory = (from: string, to: string) => {
    fs.mkdirSync(to, {recursive: true})
    for (const item of fs.readdirSync(from)) {
        const source = path.join(from, item)
        const target = path.join(to, item)
        fs.rmSync(target, {recursive: true, force: true})
        try {
            fs.renameSync(source, target)
        } catch {
            // cross-device: copy then drop the temporary copy
            fs.cpSync(source, target, {recursive: true, force: true})
            fs.rmSync(source, {recursive: true, force: true})
        }
    }
}

// pip operations are serialized: a scheduled task or CLI request may start while
// an install is writing files.
let queue: Promise<any> = Promise.resolve()

const withLock = <T>(fn: () => Promise<T>): Promise<T> => {
    const next = queue.then(fn, fn)
    queue = next.then(
        () => undefined,
        () => undefined,
    )
    return next
}

const install = async (
    packages: string[],
    option?: {indexUrl?: string},
): Promise<{ok: boolean; log: string; error?: string}> => {
    const list = (packages || []).map((item) => String(item || '').trim()).filter(Boolean)
    if (!list.length) return {ok: false, log: '', error: 'PackageRequired'}
    return withLock(async () => {
        ensure()
        const tmp = path.join(AppEnv.dataRoot || process.cwd(), 'python', `.install-${Date.now()}`)
        fs.rmSync(tmp, {recursive: true, force: true})
        fs.mkdirSync(tmp, {recursive: true})
        const args = [
            '-m',
            'pip',
            'install',
            '--upgrade',
            '--target',
            tmp,
            '--no-warn-script-location',
            '--disable-pip-version-check',
            ...(option?.indexUrl ? ['-i', option.indexUrl] : []),
            ...list,
        ]
        const lines: string[] = []
        const push = (data: string) => {
            const text = String(data || '')
            lines.push(text)
            Events.broadcast('PyenvInstallLog', {packages: list, line: text})
        }
        Log.info('Pyenv.Install', {packages: list})
        try {
            const child = await Apps.spawnShell([pythonPath(), ...args], {
                shell: false,
                cwd: tmp,
                successExitCodes: [0],
                env: {
                    PIP_NO_INPUT: '1',
                    PIP_CACHE_DIR: cachePath(),
                    PYTHONUNBUFFERED: '1',
                },
                stdout: push,
                stderr: push,
            })
            await child.result()
        } catch (e: any) {
            fs.rmSync(tmp, {recursive: true, force: true})
            const message = String(e?.message || e)
            Log.error('Pyenv.InstallFailed', {packages: list, message})
            Events.broadcast('PyenvInstallLog', {packages: list, line: '', done: true, ok: false})
            return {ok: false, log: lines.join(''), error: message}
        }
        mergeDirectory(tmp, sitePath())
        fs.rmSync(tmp, {recursive: true, force: true})
        Events.broadcast('PyenvInstallLog', {packages: list, line: '', done: true, ok: true})
        Log.info('Pyenv.Installed', {packages: list})
        return {ok: true, log: lines.join('')}
    })
}

const removeByRecord = (distInfo: string, root: string) => {
    let removed = 0
    const record = path.join(distInfo, 'RECORD')
    if (fs.existsSync(record)) {
        for (const line of fs.readFileSync(record, 'utf8').split('\n')) {
            const relative = line.split(',')[0]
            if (!relative) continue
            const file = path.resolve(root, relative)
            if (!file.startsWith(root + path.sep)) continue
            try {
                if (fs.existsSync(file)) {
                    fs.rmSync(file, {recursive: true, force: true})
                    removed++
                }
            } catch {
                // locked file (Windows): leave it, the dist-info still goes away
            }
        }
    }
    fs.rmSync(distInfo, {recursive: true, force: true})
    return removed
}

/**
 * Best effort: `pip --target` installs a flat tree, so a package may share files
 * with another one. "Clear" is the guaranteed reset.
 */
const uninstall = async (name: string): Promise<{ok: boolean; removed: number}> =>
    withLock(async () => {
        const target = normalizeName(name)
        const dir = sitePath()
        if (!fs.existsSync(dir)) return {ok: true, removed: 0}
        let removed = 0
        for (const item of fs.readdirSync(dir)) {
            if (!item.endsWith('.dist-info')) continue
            const stem = item.slice(0, -'.dist-info'.length)
            const index = stem.lastIndexOf('-')
            if (index <= 0) continue
            if (normalizeName(stem.slice(0, index)) !== target) continue
            removed += removeByRecord(path.join(dir, item), dir)
        }
        Log.info('Pyenv.Uninstalled', {name, removed})
        return {ok: true, removed}
    })

const clear = async (): Promise<{ok: boolean}> =>
    withLock(async () => {
        fs.rmSync(overlayRoot(), {recursive: true, force: true})
        ensure()
        Log.info('Pyenv.Cleared')
        return {ok: true}
    })

/** Requirements that are not installed yet (distribution names). */
const check = (requirements: string[]): string[] => {
    const list = (requirements || []).map((item) => String(item || '').trim()).filter(Boolean)
    if (!list.length) return []
    const code = [
        'import json',
        'from importlib.metadata import distributions',
        'print(json.dumps(sorted({(d.metadata["Name"] or "").lower().replace("_", "-") for d in distributions()})))',
    ].join('\n')
    try {
        ensure()
        const out = execFileSync(pythonPath(), ['-c', code], {
            encoding: 'utf8',
            timeout: 20000,
            env: {...process.env, ...buildEnv()},
        })
        const have = new Set<string>(JSON.parse(out))
        return list.filter((item) => !have.has(requirementName(item)))
    } catch (e: any) {
        Log.error('Pyenv.CheckFailed', {message: String(e?.message || e)})
        // never block a run because the metadata scan failed
        return []
    }
}

const openDir = async () => {
    ensure()
    return await shell.openPath(overlayRoot())
}

ipcMain.handle('pyenv:info', async () => info())
ipcMain.handle('pyenv:install', async (_, packages: string[], option?: {indexUrl?: string}) =>
    install(packages, option),
)
ipcMain.handle('pyenv:uninstall', async (_, name: string) => uninstall(name))
ipcMain.handle('pyenv:clear', async () => clear())
ipcMain.handle('pyenv:check', async (_, requirements: string[]) => check(requirements))
ipcMain.handle('pyenv:taskEnv', async () => buildEnv())
ipcMain.handle('pyenv:openDir', async () => openDir())

export const Pyenv = {
    pythonPath,
    ensure,
    buildEnv,
    info,
    install,
    uninstall,
    clear,
    check,
}

export default Pyenv
