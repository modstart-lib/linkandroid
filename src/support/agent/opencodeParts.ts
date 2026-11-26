/**
 * Lazy part loading: a stored assistant message only keeps the OpenCode message ids
 * of its turn. Reasoning and tool steps are read back from the OpenCode session on
 * demand, so the business database does not keep a second copy of them.
 */
import type {AgentMessageRecord} from './agentSession'
import {chatImageSrc} from './chatImageStore'
import {buildLiveParts, type AgentLivePart} from './types'

/** The worker runs one request at a time, so a stuck read must not block the list. */
const CONTEXT_TIMEOUT_MS = 3000

export const parseParts = (text: string): AgentLivePart[] => {
    if (!text) return []
    try {
        const value = JSON.parse(text)
        return Array.isArray(value) ? value : []
    } catch {
        return []
    }
}

/**
 * Parts that can be shown before hydration. Images stored on disk keep a relative
 * path the browser cannot load, so they wait for chatImageSrc instead of breaking.
 */
export const storedParts = (text: string) =>
    parseParts(text).filter(
        (part) => part.type !== 'image' || part.url.startsWith('data:') || part.url.startsWith('http'),
    )

export const parseMessageIds = (text: string): string[] => {
    if (!text) return []
    try {
        const value = JSON.parse(text)
        return Array.isArray(value) ? value.map((id) => String(id)) : []
    } catch {
        return []
    }
}

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number): Promise<T | null> => {
    let timer: ReturnType<typeof setTimeout> | null = null
    const guard = new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), timeoutMs)
    })
    try {
        return await Promise.race([promise, guard])
    } finally {
        if (timer) clearTimeout(timer)
    }
}

const resolveImages = async (parts: AgentLivePart[]) => {
    for (const part of parts) {
        if (part.type !== 'image' || !part.url || part.url.startsWith('data:')) continue
        part.url = await chatImageSrc(part.url)
    }
    return parts
}

export type HydratedMessageParts = {
    parts: Record<number, AgentLivePart[]>
    /** Rows whose steps could not be read back (OpenCode unavailable or content gone) */
    missing: number[]
}

/**
 * Resolve renderable parts for every message row: legacy rows keep their stored
 * parts, rows with OpenCode ids read the turn's messages back in one request.
 */
export const hydrateAgentMessages = async (
    rows: AgentMessageRecord[],
    opencodeSessionId: string,
): Promise<HydratedMessageParts> => {
    const result: HydratedMessageParts = {parts: {}, missing: []}
    const pending: Array<{rowId: number; ids: string[]}> = []
    for (const row of rows) {
        const ids = parseMessageIds(row.opencode_message_ids)
        if (ids.length) {
            pending.push({rowId: row.id, ids})
            continue
        }
        const parts = await resolveImages(parseParts(row.parts))
        if (parts.length) result.parts[row.id] = parts
    }
    if (!opencodeSessionId || !pending.length) {
        result.missing = pending.map((item) => item.rowId)
        return result
    }
    const response = await withTimeout(
        window.$mapi.opencodeAgent.sessionContext({opencodeSessionId}),
        CONTEXT_TIMEOUT_MS,
    ).catch(() => null)
    const messages: any[] = (response?.messages || []).filter((message: any) => message?.id)
    if (!messages.length) {
        result.missing = pending.map((item) => item.rowId)
        return result
    }
    for (const item of pending) {
        const wanted = new Set(item.ids)
        // Keep the context order: one turn is several assistant messages, and the
        // stored ids are not guaranteed to be sorted the same way.
        const selected = messages.filter((message: any) => wanted.has(String(message.id)))
        const parts = await resolveImages(buildLiveParts(selected))
        if (parts.length) result.parts[item.rowId] = parts
        else result.missing.push(item.rowId)
    }
    return result
}
