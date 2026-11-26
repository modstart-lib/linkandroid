/**
 * Business dispatch for the agent worker. The generic runtime in `agent/` only
 * owns host lifecycle, sessions and timeouts; every LinkAndroid-specific
 * profile (AI chat, task AI, single-shot generation) lives in `agent-support/`.
 */
import {runAgent, type RunAgentOptions} from '../agent/core/run'
import {runGenerateText} from '../agent/generate'

export const SUPPORT_REQUEST_KINDS = ['runTaskAgent', 'runChatAgent', 'generateText'] as const

export type SupportRequestKind = (typeof SUPPORT_REQUEST_KINDS)[number]

export const isSupportRequest = (kind: string): kind is SupportRequestKind =>
    (SUPPORT_REQUEST_KINDS as readonly string[]).includes(kind)

export const runSupportRequest = async (kind: SupportRequestKind, payload: any, options: RunAgentOptions) => {
    if (kind === 'generateText') return await runGenerateText(payload)
    if (kind === 'runTaskAgent') {
        const {taskProfile} = await import('./task/profile')
        const outcome = await runAgent(payload, taskProfile, options)
        return {
            ...outcome.result,
            messages: outcome.messages,
            opencodeSessionId: outcome.opencodeSessionId,
            newMessageIds: outcome.newMessageIds,
        }
    }
    const {aiProfile} = await import('./ai/profile')
    const outcome = await runAgent(payload, aiProfile, options)
    return {
        ...outcome.result,
        messages: outcome.messages,
        opencodeSessionId: outcome.opencodeSessionId,
        newMessageIds: outcome.newMessageIds,
    }
}
