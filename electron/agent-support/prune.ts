/**
 * Session retention policy for LinkAndroid businesses. The generic core only
 * stores and lists sessions; which business keeps which session is decided here.
 */
import {listAllSessions, removeSession} from '../agent/core/session'

/** Generic one-off generations keep only the newest N sessions. */
const KEEP_LATEST_BUSINESS = 'generate'
/** AI chat sessions are tracked by their OpenCode id, others by business id. `phone-chat` stays as the legacy id of old sessions. */
const OPENCODE_ID_BUSINESSES = new Set(['ai-chat', 'phone-chat'])

/**
 * Housekeeping: drop sessions whose business record is gone and keep only the
 * newest generic-generation sessions. Sessions without our metadata are ignored.
 */
export const pruneSessions = async (
    host: any,
    input: {
        businesses: string[]
        validIds: string[]
        validOpenCodeIds: string[]
        keepGenerate: number
        /** Clock override for tests */
        nowMs?: number
    },
) => {
    const sessions = await listAllSessions(host)
    const removed: string[] = []
    const generate = sessions
        .filter((session) => session.metadata?.business === KEEP_LATEST_BUSINESS)
        .sort((a, b) => Number(b.created || 0) - Number(a.created || 0))
    for (const session of generate.slice(Math.max(0, Number(input.keepGenerate) || 0))) {
        if (await removeSession(host, session.id)) removed.push(session.id)
    }

    const validIds = new Set(input.validIds || [])
    const validOpenCodeIds = new Set(input.validOpenCodeIds || [])
    const businesses = new Set(input.businesses || [])
    const recentCutoff = (Number(input.nowMs) || Date.now()) - 10 * 60 * 1000
    for (const session of sessions) {
        const business = String(session.metadata?.business || '')
        if (!businesses.has(business)) continue
        // Never touch a session that may still be running or not yet linked.
        if (Number(session.created || 0) > recentCutoff) continue
        if (OPENCODE_ID_BUSINESSES.has(business)) {
            if (validOpenCodeIds.has(session.id)) continue
        } else if (validIds.has(String(session.metadata?.businessId || ''))) {
            continue
        }
        if (await removeSession(host, session.id)) removed.push(session.id)
    }
    return {removed}
}
