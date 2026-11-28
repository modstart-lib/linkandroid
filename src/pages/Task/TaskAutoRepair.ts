import {t} from '../../lang'
import {collectDeviceScreenshotByLa, collectDeviceXmlByLa} from './TaskRuntime'
import {resolveTaskChatModel} from '../../support/agent/agentModel'
import {buildLineDiff, diffStats} from '../../lib/diff'
import {
    createAgentSession,
    findLatestAgentSession,
    insertAgentMessage,
    loadAgentMessages,
    updateAgentSession,
} from '../../support/agent/agentSession'

export type AutoRepairInput = {
    /** Stable task uuid; empty only when the editor runs an unsaved draft */
    taskUuid: string
    /** Task run record id, recorded inside the message for traceability */
    refId?: string | number
    taskName: string
    requirement: string
    code: string
    deviceId: string
    failureLog: string
    onProgress?: (message: string) => void
}

export type AutoRepairResult = {
    ok: boolean
    code?: string
    message: string
    messages?: any[]
    sessionId?: number
    opencodeSessionId?: string
}

const attemptText = (failureLog: string, refId?: string | number) => {
    const label = refId ? t('task.repairRunRef', {id: refId}) : t('task.repairInlineRun')
    return t('task.repairAttemptLog', {label, log: (failureLog || '').slice(-8000)})
}

/**
 * Ensure the per-task repair session exists, and append this attempt before the
 * agent runs. One session per task keeps "失败日志 → 改了什么" together.
 */
const prepareRepairSession = async (input: AutoRepairInput) => {
    if (!input.taskUuid) return null
    let session = await findLatestAgentSession({business: 'task-repair', businessId: input.taskUuid})
    if (!session) {
        const id = await createAgentSession({
            business: 'task-repair',
            businessId: input.taskUuid,
            title: input.taskName
                ? t('task.repairSessionTitle', {name: input.taskName})
                : t('task.repairSessionTitleShort'),
            refId: input.refId ? String(input.refId) : '',
        })
        session = await findLatestAgentSession({business: 'task-repair', businessId: input.taskUuid})
        if (!session && id) return null
    }
    if (!session) return null
    const history = await loadAgentMessages(session.id)
    const attempt = history.filter((message) => message.role === 'user').length + 1
    await insertAgentMessage({
        sessionId: session.id,
        role: 'user',
        content: t('task.repairAttempt', {attempt, log: attemptText(input.failureLog, input.refId)}),
    })
    await updateAgentSession(session.id, {refId: input.refId ? String(input.refId) : '', touch: true})
    return session
}

/**
 * Ask OpenCode to repair a task that just failed on a real device.
 * The failure log only guides the prompt; local validation still runs against the requirement.
 */
export const autoRepairTask = async (input: AutoRepairInput): Promise<AutoRepairResult> => {
    const resolved = await resolveTaskChatModel()
    if (!resolved) {
        return {ok: false, message: t('task.repairNoModel')}
    }
    if (!input.deviceId) {
        return {ok: false, message: t('hint.selectDeviceFirst')}
    }
    const requirement = (input.requirement || input.taskName || '').trim()
    if (!requirement) {
        return {ok: false, message: t('task.repairNoRequirement')}
    }

    input.onProgress?.(t('task.repairCollecting'))
    const [xmlInfo, screenshot] = await Promise.all([
        collectDeviceXmlByLa(input.deviceId).catch(() => ''),
        resolved.caps.vision ? collectDeviceScreenshotByLa(input.deviceId).catch(() => '') : Promise.resolve(''),
    ])

    const session = await prepareRepairSession(input)

    input.onProgress?.(t('task.repairGenerating'))
    const result = await window.$mapi.opencodeAgent.runTaskAgent({
        provider: resolved.provider,
        requirement,
        currentCode: input.code,
        deviceBasicInfo: '',
        xmlInfo,
        screenshotDataUrl: screenshot ? `data:image/png;base64,${screenshot}` : undefined,
        updateReadyMessage: t('task.repairReady'),
        failureLog: (input.failureLog || '').slice(-8000),
        deviceId: input.deviceId,
        timeoutMs: 480000,
        opencodeSessionId: session?.opencode_session_id || '',
        business: 'task-repair',
        businessId: input.taskUuid || '',
        refId: input.refId ? String(input.refId) : '',
        title: session?.title || (input.taskName ? t('task.repairSessionTitle', {name: input.taskName}) : undefined),
    })

    if (session) {
        await insertAgentMessage({
            sessionId: session.id,
            role: 'assistant',
            content: result.message || (result.ok ? t('task.repairApplied') : t('task.repairFailed', {error: ''})),
            opencodeMessageIds: result.newMessageIds || [],
        })
        await updateAgentSession(session.id, {
            opencodeSessionId: result.opencodeSessionId || session.opencode_session_id,
            touch: true,
        })
    }

    // Keep the pre-repair code so the user can compare or restore it later.
    if (input.taskUuid && result.ok && result.code && result.code !== input.code) {
        const diff = buildLineDiff(input.code, result.code)
        await window.$mapi.history
            .record({
                uuid: input.taskUuid,
                taskName: input.taskName,
                source: 'repair',
                sessionId: session?.id || 0,
                refId: input.refId ? String(input.refId) : '',
                previousCode: input.code,
                nextCode: result.code,
                diff,
                stats: diffStats(diff),
            })
            .catch(() => {})
    }

    return {
        ok: Boolean(result.ok && result.code),
        code: result.code,
        message: result.message,
        messages: result.messages,
        sessionId: session?.id,
        opencodeSessionId: result.opencodeSessionId,
    }
}
