/**
 * electron/lib/client-config.ts — 客户端入口配置
 *
 * 不管是本地软件还是 CLI 工具，统一按以下流程工作：
 * 1. 检查 LINKANDROID_DATA_ROOT 环境变量（有值则直接作为数据目录，支持 ~ 展开，优先级最高）
 * 2. 读取 ~/.linkandroid/client.json（所有平台固定如此）
 * 3. 从 dataRoot 字段获取数据目录（默认 ~/.linkandroid/data）
 * 4. 如果 client.json 不存在则自动创建
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const CLIENT_CONFIG_DIR = '.linkandroid'
const CLIENT_CONFIG_FILE = 'client.json'
const DEFAULT_DATA_ROOT = '~/.linkandroid/data'

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
    dataRoot: string
}

/**
 * 确保 client.json 存在，返回解析后的配置
 *
 * 数据目录优先级：
 * 1. LINKANDROID_DATA_ROOT 环境变量（有值，支持 ~ 展开，优先级最高）
 * 2. ~/.linkandroid/client.json 的 dataRoot
 * 3. 默认 ~/.linkandroid/data
 *
 * 环境变量分支不写 client.json，其余逻辑：
 * 1. 读取 ~/.linkandroid/client.json
 * 2. 若不存在则自动创建（含 dataRoot 默认值）
 * 3. 若 dataRoot 为空则用默认值回填
 * 4. 展开 ~ 为实际 home 目录
 */
export function ensureClientConfig(): ClientConfig {
    // 环境变量优先级最高（正式安装版由 macOS Info.plist 的 LSEnvironment 注入，
    // 用于把正式使用数据隔离到独立目录，避免被开发测试的种子数据污染）
    const envDataRoot = process.env.LINKANDROID_DATA_ROOT
    if (envDataRoot && envDataRoot.trim()) {
        return {
            dataRoot: path.resolve(expandTilde(envDataRoot.trim())),
        }
    }

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

    if (!raw.dataRoot || typeof raw.dataRoot !== 'string') {
        raw.dataRoot = DEFAULT_DATA_ROOT
    }

    // 确保目录存在
    if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, {recursive: true})
    }

    // 文件不存在或损坏时重新写入
    if (!fs.existsSync(configPath)) {
        fs.writeFileSync(configPath, JSON.stringify({dataRoot: raw.dataRoot}, null, 2) + '\n', 'utf-8')
    }

    return {
        dataRoot: expandTilde(raw.dataRoot as string),
    }
}

/**
 * 直接读取 client.json 获取 dataRoot（不创建文件）
 * 用于 CLI 等不希望 side-effect 的场景
 */
export function readClientConfig(): ClientConfig | null {
    const configPath = clientConfigPath()
    if (!fs.existsSync(configPath)) {
        return null
    }
    try {
        const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
        if (raw.dataRoot && typeof raw.dataRoot === 'string') {
            return {dataRoot: expandTilde(raw.dataRoot)}
        }
    } catch {
        // ignore
    }
    return null
}
