/**
 * Low-frequency housekeeping for the agent session store:
 * - drop leftover per-request sqlite files from the old implementation
 * - remove sessions whose business record no longer exists
 * - keep only the newest generic-generation sessions
 */
import fs from 'node:fs'
import path from 'node:path'
import {AppEnv} from '../env'
import ConfigMain from '../config/main'
import DBMain from '../db/main'
import Log from '../log/main'
import {OpenCodeAgent} from './main'

const CONFIG_KEY = 'opencodeAgentMaintainAt'
const DAY_MS = 24 * 60 * 60 * 1000
const START_DELAY_MS = 60 * 1000
const KEEP_GENERATE = 500

const removeLegacyRequestDbs = () => {
    try {
        const dir = path.join(AppEnv.dataRoot || process.cwd(), 'opencode-agent', 'requests')
        fs.rmSync(dir, {recursive: true, force: true})
    } catch {}
}

/** Chat screenshots belong to one session row; drop the folders of deleted sessions. */
const removeOrphanChatImages = async () => {
    const root = path.join(AppEnv.dataRoot || process.cwd(), 'chat-images')
    if (!fs.existsSync(root)) return
    const rows: any[] = await DBMain.select('SELECT id FROM agent_chat_session')
    const valid = new Set((rows || []).map((row) => String(row.id)))
    const now = Date.now()
    for (const name of fs.readdirSync(root)) {
        if (valid.has(name)) continue
        const dir = path.join(root, name)
        try {
            // A session row created moments ago must never lose its images.
            if (now - fs.statSync(dir).mtimeMs < 60 * 60 * 1000) continue
            fs.rmSync(dir, {recursive: true, force: true})
        } catch {}
    }
}

const runMaintain = async () => {
    removeLegacyRequestDbs()
    await removeOrphanChatImages()
    const last = Number(await ConfigMain.get(CONFIG_KEY, 0)) || 0
    if (Date.now() - last < DAY_MS) return
    await ConfigMain.set(CONFIG_KEY, Date.now())

    const sessions: any[] = await DBMain.select(
        'SELECT business, business_id, opencode_session_id FROM agent_chat_session',
    )
    const validIds = (sessions || []).map((row) => String(row.business_id || '')).filter(Boolean)
    const validOpenCodeIds = (sessions || []).map((row) => String(row.opencode_session_id || '')).filter(Boolean)
    const result = await OpenCodeAgent.pruneSessions({
        // 'phone-chat' is the legacy id still stored in OpenCode metadata of old sessions
        businesses: ['ai-chat', 'phone-chat', 'task-chat', 'task-repair'],
        validIds,
        validOpenCodeIds,
        keepGenerate: KEEP_GENERATE,
    })
    Log.info('OpenCodeAgent.Maintain', {removed: result.removed.length})
}

/** Runs shortly after startup so it never competes with the first render. */
export const startAgentMaintenance = () => {
    const timer = setTimeout(() => {
        void runMaintain().catch((error) => {
            Log.error('OpenCodeAgent.MaintainFailed', {message: String(error?.message || error)})
        })
    }, START_DELAY_MS)
    timer.unref?.()
}
