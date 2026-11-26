/**
 * Fixed OpenCode session storage and business metadata.
 * All agent sessions live in one sqlite file under the app data root.
 */
import {randomBytes} from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import type {AgentBusiness, AgentRunInput, AgentSessionInfo} from './types'

export const AGENT_DIR = 'opencode-agent'
export const AGENT_DB_FILE = 'agent.sqlite'

export const agentRoot = (dataRoot: string) => path.join(dataRoot || process.cwd(), AGENT_DIR)
export const agentDbPath = (dataRoot: string) => path.join(agentRoot(dataRoot), 'db', AGENT_DB_FILE)
export const agentWorkspace = (dataRoot: string) => path.join(agentRoot(dataRoot), 'workspace')

/**
 * Resolve the OpenCode working directory for a session.
 * An explicit directory wins; otherwise every session gets a random directory
 * under the workspace, so OpenCode never falls back to the app's own cwd.
 */
export const resolveSessionDirectory = (dataRoot: string, directory?: string) => {
    const wanted = String(directory || '').trim()
    const resolved = wanted
        ? path.isAbsolute(wanted)
            ? wanted
            : path.join(agentWorkspace(dataRoot), wanted)
        : path.join(agentWorkspace(dataRoot), randomBytes(6).toString('hex'))
    fs.mkdirSync(resolved, {recursive: true})
    return resolved
}

/** The SDK opens the database file directly, so every parent directory must exist. */
export const ensureAgentDirs = (dataRoot: string) => {
    for (const dir of [path.dirname(agentDbPath(dataRoot)), agentWorkspace(dataRoot)]) {
        fs.mkdirSync(dir, {recursive: true})
    }
}

export const buildSessionMeta = (input: AgentRunInput, business: AgentBusiness, profile: string) => ({
    business,
    businessId: input.businessId || '',
    profile,
    refId: input.refId || '',
    appVersion: process.env.APP_VERSION || '',
})

export const sessionTitle = (input: AgentRunInput, fallback: string) => {
    const title = String(input.title || '').trim()
    return title || fallback
}

/** A resumed session keeps its directory; recreate it when that directory is gone. */
const ensureSessionDirectory = async (host: any, session: any, dataRoot: string, requested?: string) => {
    const current = String(session?.location?.directory || '').trim()
    if (current && fs.existsSync(current)) return
    const directory = resolveSessionDirectory(dataRoot, requested)
    try {
        await host.session.move({sessionID: session.id, directory})
    } catch {
        // Moving can fail while the old directory is gone; keep the session usable.
        if (current) fs.mkdirSync(current, {recursive: true})
    }
}

/** Resume the given session when it still exists, otherwise create a new one. */
export const openOrCreateSession = async (host: any, dataRoot: string, input: AgentRunInput, title: string) => {
    if (input.opencodeSessionId) {
        const existing = await host.session.get({sessionID: input.opencodeSessionId}).catch(() => null)
        if (existing) {
            await ensureSessionDirectory(host, existing, dataRoot, input.directory)
            return {session: existing, created: false}
        }
    }
    const session = await host.session.create({
        location: {directory: resolveSessionDirectory(dataRoot, input.directory)},
        title,
    })
    return {session, created: true}
}

export const applySessionMeta = async (
    host: any,
    sessionID: string,
    meta: Record<string, any>,
    title?: string,
    created = false,
) => {
    // A session created by this run always gets our title; a resumed session keeps
    // the user's own rename unless the caller explicitly overrides it.
    const nextTitle = created ? title : String(title || '').trim() || undefined
    await host.session.update({sessionID, ...(nextTitle ? {title: nextTitle} : {}), metadata: meta}).catch(() => {})
}

export const readSessionContext = async (host: any, sessionID: string): Promise<any[]> => {
    try {
        return await host.session.context({sessionID})
    } catch {
        return []
    }
}

/**
 * Replay display history into a session without model calls.
 * Uses synthetic messages so the model sees the earlier turns but no fake replies
 * are generated and the visible message list stays clean.
 */
export const replayMessages = async (
    host: any,
    sessionID: string,
    messages: Array<{role: 'user' | 'assistant'; content: string}>,
) => {
    for (const item of messages || []) {
        const text = String(item?.content || '').trim()
        if (!text) continue
        await host.session.synthetic({
            sessionID,
            text: `${item.role === 'user' ? '用户' : '助手'}：${text.slice(0, 4000)}`,
            description: 'history',
        })
    }
}

export const removeSession = async (host: any, sessionID: string) => {
    if (!sessionID) return false
    try {
        await host.session.remove({sessionID})
        return true
    } catch {
        return false
    }
}

export const removeBusinessSessions = async (host: any, businesses: AgentBusiness[], businessId: string) => {
    if (!businessId) return 0
    const wanted = new Set(businesses)
    const sessions = await listAllSessions(host)
    let removed = 0
    for (const session of sessions) {
        const meta = session.metadata || {}
        if (!wanted.has(meta.business) || String(meta.businessId || '') !== businessId) continue
        if (await removeSession(host, session.id)) removed++
    }
    return removed
}

/** Page through every session; the SDK has no metadata filter, so callers filter locally. */
export const listAllSessions = async (host: any): Promise<AgentSessionInfo[]> => {
    const all: AgentSessionInfo[] = []
    const seen = new Set<string>()
    let cursor: string | undefined
    for (let page = 0; page < 50; page++) {
        const result: any = await host.session.list({limit: 200, ...(cursor ? {cursor} : {})}).catch(() => null)
        if (!result) break
        let added = 0
        for (const item of result.data || []) {
            if (!item?.id || seen.has(item.id)) continue
            seen.add(item.id)
            added++
            all.push({
                id: item.id,
                title: item.title || '',
                metadata: item.metadata || {},
                created: item.time?.created,
                updated: item.time?.updated,
            })
        }
        // Some SDK builds return an overlapping page cursor; stop when a page adds
        // nothing new instead of looping on the same items.
        cursor = result.cursor || undefined
        if (!cursor || added === 0) break
    }
    return all
}

export const filterSessions = (sessions: AgentSessionInfo[], business?: AgentBusiness, businessId?: string) =>
    sessions.filter((session) => {
        const meta = session.metadata || {}
        if (!meta.business) return false
        if (business && meta.business !== business) return false
        if (businessId !== undefined && String(meta.businessId || '') !== String(businessId)) return false
        return true
    })
