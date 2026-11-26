/**
 * Shared store for business-owned agent sessions.
 * The app database keeps the business record, the user's own messages and the
 * final reply of each turn; reasoning and tool steps stay in the OpenCode database
 * and are lazy-loaded by message id when a session is opened. Deletion removes both.
 */

export type AgentBusiness = 'ai-chat' | 'task-chat' | 'task-repair' | 'generate'

export type AgentSessionRecord = {
    id: number
    title: string
    business: AgentBusiness
    business_id: string
    opencode_session_id: string
    ref_id: string
    device_id: string
    provider_id: string
    model_id: string
    created_at: string
    updated_at: string
    last_message?: string
    last_role?: string
    message_count?: number
}

export type AgentMessageRecord = {
    id: number
    session_id: number
    role: 'user' | 'assistant'
    content: string
    parts: string
    opencode_message_ids: string
    created_at: string
}

const SESSION_COLUMNS = `id, title, business, business_id, opencode_session_id, ref_id, device_id, provider_id, model_id, created_at, updated_at, last_message, last_role, message_count`

const imageDir = (sessionId: number) => `chat-images/${sessionId}`

export const createAgentSession = async (input: {
    business: AgentBusiness
    businessId?: string
    title?: string
    deviceId?: string
    providerId?: string
    modelId?: string
    refId?: string
}) => {
    const now = new Date().toISOString()
    const id = await window.$mapi.db.insert(
        `INSERT INTO agent_chat_session
            (title, business, business_id, opencode_session_id, ref_id, device_id, provider_id, model_id, created_at, updated_at)
         VALUES (?, ?, ?, '', ?, ?, ?, ?, ?, ?)`,
        [
            input.title || '',
            input.business,
            input.businessId || '',
            input.refId || '',
            input.deviceId || '',
            input.providerId || '',
            input.modelId || '',
            now,
            now,
        ],
    )
    return Number(id)
}

export const listAgentSessions = async (input: {
    business: AgentBusiness
    businessId?: string
}): Promise<AgentSessionRecord[]> => {
    const rows = await window.$mapi.db.select(
        `SELECT ${SESSION_COLUMNS} FROM agent_chat_session
         WHERE business = ? AND business_id = ?
         ORDER BY updated_at DESC, id DESC`,
        [input.business, input.businessId || ''],
    )
    return (rows || []) as AgentSessionRecord[]
}

export const findLatestAgentSession = async (input: {business: AgentBusiness; businessId?: string}) => {
    const rows = await listAgentSessions(input)
    return rows[0] || null
}

export const loadAgentSession = async (id: number): Promise<AgentSessionRecord | null> => {
    if (!id) return null
    const row = await window.$mapi.db.first(`SELECT ${SESSION_COLUMNS} FROM agent_chat_session WHERE id = ?`, [id])
    return (row as AgentSessionRecord) || null
}

export const loadAgentMessages = async (sessionId: number): Promise<AgentMessageRecord[]> => {
    if (!sessionId) return []
    const rows = await window.$mapi.db.select('SELECT * FROM agent_chat_message WHERE session_id = ? ORDER BY id ASC', [
        sessionId,
    ])
    return (rows || []) as AgentMessageRecord[]
}

/** Keep the session list columns in sync with the newest message in one place. */
const touchSessionSummary = async (sessionId: number, role: string, content: string) => {
    await window.$mapi.db.update(
        `UPDATE agent_chat_session
         SET message_count = message_count + 1, last_message = ?, last_role = ?, updated_at = ?
         WHERE id = ?`,
        [content || '', role, new Date().toISOString(), sessionId],
    )
}

export const insertAgentMessage = async (input: {
    sessionId: number
    role: 'user' | 'assistant'
    content: string
    parts?: string
    /** OpenCode messages of this turn; their parts are lazy-loaded on open */
    opencodeMessageIds?: string[]
}) => {
    const now = new Date().toISOString()
    const content = input.content || ''
    const ids = input.opencodeMessageIds?.length ? JSON.stringify(input.opencodeMessageIds) : ''
    const id = await window.$mapi.db.insert(
        'INSERT INTO agent_chat_message (session_id, role, content, parts, opencode_message_ids, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [input.sessionId, input.role, content, input.parts || '', ids, now],
    )
    await touchSessionSummary(input.sessionId, input.role, content)
    return {id: Number(id), createdAt: now}
}

/** Recompute the list columns from the message rows (bulk writers, test seeds). */
export const refreshAgentSessionSummary = async (sessionId: number) => {
    if (!sessionId) return
    await window.$mapi.db.update(
        `UPDATE agent_chat_session SET
            message_count = (SELECT COUNT(*) FROM agent_chat_message m WHERE m.session_id = ?),
            last_message = COALESCE((SELECT m.content FROM agent_chat_message m WHERE m.session_id = ? ORDER BY m.id DESC LIMIT 1), ''),
            last_role = COALESCE((SELECT m.role FROM agent_chat_message m WHERE m.session_id = ? ORDER BY m.id DESC LIMIT 1), '')
         WHERE id = ?`,
        [sessionId, sessionId, sessionId, sessionId],
    )
}

export const deleteAgentMessages = async (sessionId: number) => {
    await window.$mapi.db.delete('DELETE FROM agent_chat_message WHERE session_id = ?', [sessionId])
    await window.$mapi.db.update(
        "UPDATE agent_chat_session SET message_count = 0, last_message = '', last_role = '' WHERE id = ?",
        [sessionId],
    )
}

export const updateAgentSession = async (
    id: number,
    patch: {
        title?: string
        opencodeSessionId?: string
        providerId?: string
        modelId?: string
        deviceId?: string
        refId?: string
        touch?: boolean
    },
) => {
    if (!id) return
    const sets: string[] = []
    const params: any[] = []
    if (patch.title !== undefined) {
        sets.push('title = ?')
        params.push(patch.title)
    }
    if (patch.opencodeSessionId !== undefined) {
        sets.push('opencode_session_id = ?')
        params.push(patch.opencodeSessionId)
    }
    if (patch.providerId !== undefined) {
        sets.push('provider_id = ?')
        params.push(patch.providerId)
    }
    if (patch.modelId !== undefined) {
        sets.push('model_id = ?')
        params.push(patch.modelId)
    }
    if (patch.deviceId !== undefined) {
        sets.push('device_id = ?')
        params.push(patch.deviceId)
    }
    if (patch.refId !== undefined) {
        sets.push('ref_id = ?')
        params.push(patch.refId)
    }
    if (patch.touch !== false) {
        sets.push('updated_at = ?')
        params.push(new Date().toISOString())
    }
    if (sets.length === 0) return
    params.push(id)
    await window.$mapi.db.update(`UPDATE agent_chat_session SET ${sets.join(', ')} WHERE id = ?`, params)
}

/** Delete the business record first, then the OpenCode session (never blocks the UI). */
export const deleteAgentSession = async (id: number) => {
    const session = await loadAgentSession(id)
    await window.$mapi.db.delete('DELETE FROM agent_chat_message WHERE session_id = ?', [id])
    await window.$mapi.db.delete('DELETE FROM agent_chat_session WHERE id = ?', [id])
    await window.$mapi.file.deletes(imageDir(id), {isDataPath: true}).catch(() => {})
    if (session?.opencode_session_id) {
        await window.$mapi.opencodeAgent.sessionRemove({opencodeSessionId: session.opencode_session_id}).catch(() => {})
    }
}
