/**
 * Built-in OpenCode tools kept for profiles that also work on the PC.
 * They run as the logged-in user, which is how an agent can read/write local
 * files (CSV exports, logs) and inspect the machine next to the phone control.
 */
export const HOST_TOOL_NAMES = ['read', 'write', 'edit', 'patch', 'glob', 'grep', 'shell'] as const

/**
 * Real home of the logged-in user. The agent worker runs with an isolated HOME,
 * so prompts must carry the absolute path when a file should land on the real
 * desktop.
 */
export const hostHomeDir = () => String(process.env.LINKANDROID_HOME || '').trim()

export const hostDesktopHint = () => {
    const home = hostHomeDir()
    if (!home) return ''
    return `电脑家目录：${home}；电脑桌面目录：${home}/Desktop（写文件用绝对路径，shell 里的 ~ 是隔离目录，不是电脑家目录）。`
}
