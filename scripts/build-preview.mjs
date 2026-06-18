/**
 * _temp/buildPreview.mjs — 构建前自动清理残留进程，防止端口/文件锁冲突。
 *
 * 用法: node _temp/buildPreview.mjs
 *
 * 步骤:
 *   1. kill 所有 linkandroid 相关的 vite、electron 进程
 *   2. 运行 prettier 格式化
 *   3. 运行 vite build（渲染层 + 主进程 + preload）
 */

import {execSync, spawnSync} from 'node:child_process'
import {resolve} from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')

function run(cmd, args, opts = {}) {
    const result = spawnSync(cmd, args, {
        cwd: ROOT,
        stdio: 'inherit',
        env: {...process.env, ...opts.env},
        timeout: opts.timeout || 300_000,
    })
    if (result.error) {
        console.error(`[buildPreview] 命令失败: ${cmd} ${args.join(' ')}`, result.error)
        process.exit(1)
    }
    if (result.status !== 0) {
        console.error(`[buildPreview] 命令退出码 ${result.status}: ${cmd} ${args.join(' ')}`)
        process.exit(result.status)
    }
}

// 1. 清理残留进程
console.log('[buildPreview] 清理残留进程...')
try {
    // kill 当前项目下的 vite 进程
    execSync('pkill -9 -f "vite.*linkandroid" 2>/dev/null || true', {stdio: 'ignore'})
} catch {}
try {
    // kill 当前项目下的 electron 进程
    execSync('pkill -9 -f "linkandroid-pro/node_modules/electron" 2>/dev/null || true', {stdio: 'ignore'})
} catch {}
try {
    // kill 可能遗留的 linkandroid 相关 node 进程
    execSync('pkill -9 -f "linkandroid.*vite" 2>/dev/null || true', {stdio: 'ignore'})
} catch {}
// 确保端口释放
try {
    execSync('lsof -ti:3344 | xargs kill -9 2>/dev/null || true', {stdio: 'ignore'})
} catch {}

console.log('[buildPreview] 进程清理完成')

// 2. 格式化
console.log('[buildPreview] 格式化代码...')
run('npx', ['prettier', '--write', '--log-level', 'warn', '"src/**/*.{ts,tsx,vue,js}"', '"electron/**/*.{ts,tsx,js}"'], {
    timeout: 120_000,
    shell: true,
})

// 3. 构建
console.log('[buildPreview] 执行 vite build...')
run('npx', ['vite', 'build'], {timeout: 300_000})
