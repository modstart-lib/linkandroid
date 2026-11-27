/**
 * Generic single-shot generation profile. It keeps its session in the fixed
 * database but has no business record or UI entry; the store is trimmed by the
 * periodic maintenance job.
 */
import {t} from '../config/lang'
import {createProviderPlugin, loadSdk, MODEL_ID, PROVIDER_ID} from './core/provider'
import {createAgentHost, closeHost, withTimeout} from './core/run'
import {applySessionMeta, buildSessionMeta, openOrCreateSession, sessionTitle} from './core/session'
import type {AgentProvider, AgentRunInput} from './core/types'

export type GenerateTextInput = AgentRunInput & {
    provider: AgentProvider
    prompt: string
    systemPrompt?: string
}

export type GenerateTextResult = {
    code: number
    msg: string
    data?: {content?: string}
    durationMs: number
    opencodeSessionId?: string
}

export const runGenerateText = async (input: GenerateTextInput): Promise<GenerateTextResult> => {
    const startedAt = Date.now()
    const timeoutMs = input.timeoutMs || 60000
    let host: any = null
    let sessionID = ''
    try {
        const providerPlugin = await createProviderPlugin(input.provider)
        const {Plugin} = await loadSdk()
        const generatePlugin = Plugin.define({
            id: 'linkandroid-generate',
            async setup(ctx: any) {
                const applySystem = (event: any) => {
                    for (const key of Object.keys(event.tools || {})) delete event.tools[key]
                    event.system = input.systemPrompt ? [{type: 'text', text: input.systemPrompt}] : []
                }
                await ctx.session.hook('context', applySystem)
                await ctx.session.hook('generate', applySystem)
            },
        })
        host = await createAgentHost(input.dataRoot, [providerPlugin, generatePlugin])
        const title = sessionTitle(
            input,
            t('agent.genericSessionTitle', {time: new Date().toLocaleString(undefined, {hour12: false})}),
        )
        const opened = await openOrCreateSession(host, input.dataRoot, input, title)
        sessionID = opened.session.id
        await applySessionMeta(
            host,
            sessionID,
            buildSessionMeta(input, input.business || 'generate', 'generate'),
            title,
            opened.created,
        )
        await host.session.switchModel({
            sessionID,
            model: {providerID: PROVIDER_ID, id: input.provider.modelId || MODEL_ID},
        })
        const generated = await withTimeout<{text: string}>(
            host.session.generate({sessionID, prompt: input.prompt}),
            timeoutMs,
            async () => {
                await host.session.interrupt({sessionID, resume: false}).catch(() => {})
            },
        )
        if (!generated) {
            return {
                code: -1,
                msg: t('agent.responseTimeout', {ms: timeoutMs}),
                durationMs: Date.now() - startedAt,
                opencodeSessionId: sessionID,
            }
        }
        return {
            code: 0,
            msg: 'ok',
            data: {content: generated.text || ''},
            durationMs: Date.now() - startedAt,
            opencodeSessionId: sessionID,
        }
    } catch (error: any) {
        return {
            code: -1,
            msg: String(error?.message || error),
            durationMs: Date.now() - startedAt,
            opencodeSessionId: sessionID,
        }
    } finally {
        await closeHost(host)
    }
}
