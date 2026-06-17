/**
 * electron/lib/client-config.ts — 客户端入口配置
 *
 * 不管是本地软件还是 CLI 工具，统一按以下流程工作：
 * 1. 读取 ~/.linkandroid/client.json
 * 2. 从 dataPath 字段获取数据目录（默认 ~/.linkandroid/data）
 * 3. 如果 client.json 不存在则自动创建
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const CLIENT_CONFIG_DIR = '.linkandroid'
const CLIENT_CONFIG_FILE = 'client.json'
const DEFAULT_DATA_PATH = '~/.linkandroid/data'

function clientConfigPath(): string {
    return path.join(os.homedir(), CLIENT_CONFIG_DIR, CLIENT_CONFIG_FILE)
}

/**
 * 展开路径中的 ~ 为当前用户 home 目录
 */
function expandTilde(p: string): string {
    if (p.startsWith('~')) {
        return path.join(os.homedir(), p.slice(1))
    }
    return p
}

export interface ClientConfig {
    dataPath: string
}

/**
 * 确保 client.json 存在，返回解析后的配置
 *
 * 逻辑：
 * 1. 读取 ~/.linkandroid/client.json
 * 2. 若不存在则自动创建（含 dataPath 默认值）
 * 3. 若 dataPath 为空则用默认值回填
 * 4. 展开 ~ 为实际 home 目录
 */
export function ensureClientConfig(): ClientConfig {
    const configPath = clientConfigPath()
    const configDir = path.dirname(configPath)

    let raw: Record<string, unknown> = {}

    if (fs.existsSync(configPath)) {
        try {
            raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
        } catch {
            // 文件损坏，重置为默认值
            raw = {}
        }
    }

    if (!raw.dataPath || typeof raw.dataPath !== 'string') {
        raw.dataPath = DEFAULT_DATA_PATH
    }

    // 确保目录存在
    if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, {recursive: true})
    }

    // 文件不存在或损坏时重新写入
    if (!fs.existsSync(configPath)) {
        fs.writeFileSync(configPath, JSON.stringify({dataPath: raw.dataPath}, null, 2) + '\n', 'utf-8')
    }

    return {
        dataPath: expandTilde(raw.dataPath as string),
    }
}

/**
 * 直接读取 client.json 获取 dataPath（不创建文件）
 * 用于 CLI 等不希望 side-effect 的场景
 */
export function readClientConfig(): ClientConfig | null {
    const configPath = clientConfigPath()
    if (!fs.existsSync(configPath)) {
        return null
    }
    try {
        const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
        if (raw.dataPath && typeof raw.dataPath === 'string') {
            return {dataPath: expandTilde(raw.dataPath)}
        }
    } catch {
        // ignore
    }
    return null
}
