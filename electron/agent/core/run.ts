/**
 * Generic agent runtime: fixed session storage, host lifecycle, round loop,
 * timeouts and provider failure mapping. Business differences live in profiles.
 */
import {randomBytes} from 'node:crypto'
import {t} from '../../config/lang'
import {createProviderPlugin, loadSdk, MODEL_ID, PROVIDER_ID} from './provider'
import {
    agentDbPath,
    applySessionMeta,
    buildSessionMeta,
    ensureAgentDirs,
    openOrCreateSession,
    readSessionContext,
    sessionTitle,
} from './session'
import {startProgressStream} from '../progress'
import type {AgentProfile, AgentRunInput, AgentRunOutcome} from './types'

export const createAgentHost = async (dataRoot: string, plugins: any[] = []) => {
    ensureAgentDirs(dataRoot)
    const {OpenCode} = await loadSdk()
    return OpenCode.create({
        plugins,
        database: {path: agentDbPath(dataRoot)},
        models: {fetch: false, snapshot: false},
        fs: {filewatcher: false},
    })
}

export const withTimeout = async <T>(
    promise: Promise<T>,
    timeoutMs: number,
    onTimeout: () => Promise<void>,
): Promise<T | null> => {
    let timer: NodeJS.Timeout | null = null
    const timeout = new Promise<null>((resolve) => {
        timer = setTimeout(() => {
            void onTimeout().catch(() => {})
            resolve(null)
        }, timeoutMs)
    })
    try {
        return await Promise.race([promise, timeout])
    } finally {
        if (timer) clearTimeout(timer)
    }
}

/** A long agent task may legitimately run for a long time; only a stalled model counts as stuck. */
export const DEFAULT_IDLE_TIMEOUT_MS = 10 * 60 * 1000

/**
 * Wait for one agent turn with two guards:
 * - `idleMs` since the last progress event (streaming text / tool parts),
 * - `totalMs` for the whole turn as a safety cap.
 * Returns the reason when it gave up, so callers can explain what happened.
 */
export const withIdleTimeout = async <T>(
    promise: Promise<T>,
    options: {idleMs: number; totalMs: number; lastActivity: () => number},
    onTimeout: (reason: 'idle' | 'total') => Promise<void>,
): Promise<{value: T | null; reason: 'idle' | 'total' | null}> => {
    const started = Date.now()
    let reason: 'idle' | 'total' | null = null
    let timer: NodeJS.Timeout | null = null
    const guard = new Promise<null>((resolve) => {
        timer = setInterval(() => {
            if (reason) return
            const now = Date.now()
            const hit =
                now - started >= options.totalMs
                    ? 'total'
                    : now - options.lastActivity() >= options.idleMs
                      ? 'idle'
                      : null
            if (!hit) return
            reason = hit
            void onTimeout(hit).catch(() => {})
            resolve(null)
        }, 5000)
    })
    try {
        return await Promise.race([
            promise.then((value) => ({value, reason: null as null})),
            guard.then(() => ({value: null, reason})),
        ])
    } finally {
        if (timer) clearInterval(timer)
    }
}

export const closeHost = async (host: any) => {
    try {
        await withTimeout(host?.close() || Promise.resolve(), 5000, async () => {})
    } catch {}
}

/** Provider auth/quota failures never succeed on retry: surface them right away. */
export const findProviderFailure = (messages: any[]): {code: string; message: string} | null => {
    for (const message of [...(messages || [])].reverse()) {
        const type = String(message?.error?.type || '')
        if (type === 'provider.auth' || type === 'provider.quota') {
            return {code: type, message: String(message.error.message || type)}
        }
    }
    return null
}

/** Tool calls that are not in the allowed set (e.g. code lines used as tool names). */
export const unknownToolCalls = (messages: any[], allowed: Set<string>) => {
    const names = new Set<string>()
    let count = 0
    for (const message of messages || []) {
        for (const part of message?.content || []) {
            if (part?.type !== 'tool') continue
            const name = String(part?.name || part?.tool || '').trim()
            if (!name || allowed.has(name)) continue
            names.add(name)
            count++
        }
    }
    return {count, names: Array.from(names).slice(0, 6)}
}

const errorResult = (error: any) => ({
    ok: false,
    message: String(error?.message || error),
    error: {code: error?.type || error?.code || '', message: String(error?.message || error)},
})

export type RunAgentOptions = {
    onProgress?: (messages: any[]) => void
    /** True after the user pressed stop; the loop exits with an aborted result. */
    isAborted?: () => boolean
    /** Registers the cancel handle for out-of-band interrupts (null when done). */
    onAbortHandle?: (handle: (() => Promise<void>) | null) => void
}

/**
 * Run one profile turn-loop against a fixed-database session.
 * The profile supplies the prompt, tools and completion rule; everything else
 * (session create/resume, metadata, timeout, progress) is handled here.
 */
export const runAgent = async <TResult>(
    input: AgentRunInput,
    profile: AgentProfile<any, TResult>,
    options?: RunAgentOptions,
): Promise<AgentRunOutcome<TResult>> => {
    const startedAt = Date.now()
    const requestId = randomBytes(4).toString('hex')
    const business = input.business || profile.business(input)
    const maxRounds = Math.max(1, profile.maxRounds(input))
    const timeoutMs = input.timeoutMs || profile.timeoutMs(input)
    const idleMs = Math.max(60000, Number(input.idleTimeoutMs || DEFAULT_IDLE_TIMEOUT_MS))
    const title = sessionTitle(input, profile.title(input))
    const state = profile.createState(input)
    let host: any = null
    let sessionID = ''
    let messages: any[] = []
    // Messages already in the session before this run; declared here so the error
    // path can still diff them without touching an uninitialised binding.
    let knownIds = new Set<string>()
    let stopProgress: (() => void) | null = null

    /** Assistant messages created by this run, used to lazy-load their parts later. */
    const collectNewMessageIds = () =>
        (messages || [])
            .filter(
                (message: any) =>
                    message?.id &&
                    message.type === 'assistant' &&
                    !knownIds.has(message.id) &&
                    Number(message.time?.created || 0) >= startedAt,
            )
            .map((message: any) => String(message.id))

    const buildOutcome = (result: any): AgentRunOutcome<TResult> => {
        const durationMs = Date.now() - startedAt
        return {
            result: {...result, requestId, durationMs},
            messages,
            opencodeSessionId: sessionID,
            newMessageIds: collectNewMessageIds(),
            requestId,
            durationMs,
        }
    }

    try {
        const providerPlugin = await createProviderPlugin(input.provider)
        const profilePlugin = await profile.plugin(input, state, {
            interrupt: () => {
                if (!host || !sessionID) return
                void host.session.interrupt({sessionID, resume: false}).catch(() => {})
            },
        })
        host = await createAgentHost(input.dataRoot, [providerPlugin, profilePlugin])

        const opened = await openOrCreateSession(host, input.dataRoot, input, title)
        sessionID = opened.session.id
        options?.onAbortHandle?.(async () => {
            if (!host || !sessionID) return
            await host.session.interrupt({sessionID, resume: false}).catch(() => {})
        })
        await applySessionMeta(
            host,
            sessionID,
            buildSessionMeta(input, business, profile.id),
            opened.created ? title : input.title,
            opened.created,
        )
        await host.session.switchModel({
            sessionID,
            model: {providerID: PROVIDER_ID, id: input.provider.modelId || MODEL_ID},
        })

        // A brand-new session replays the business-side history without model calls;
        // a resumed session already contains it.
        if (opened.created && profile.replay) {
            await profile.replay(input, state, {host, sessionID})
        }

        // Progress only reports messages created by this run; a resumed session
        // already contains the earlier conversation and must not be re-sent.
        const known = new Set((await readSessionContext(host, sessionID)).map((message: any) => message?.id))
        knownIds = known
        // Any streamed part (reasoning / text / tool) counts as progress; a model
        // that keeps working for an hour is fine, a silent one is not.
        let lastActivity = Date.now()
        const touch = () => {
            lastActivity = Date.now()
        }
        if (options?.onProgress) {
            stopProgress = startProgressStream(
                host,
                sessionID,
                (progress) => {
                    touch()
                    options.onProgress!(progress)
                },
                known,
            )
        }

        let result: TResult | null = null
        for (let round = 0; round < maxRounds; round++) {
            const turn = profile.turn(input, state, round)
            touch()
            await host.session.prompt({sessionID, text: turn.text, files: turn.files})
            const waited = await withIdleTimeout(
                host.session.wait({sessionID}),
                {idleMs, totalMs: timeoutMs, lastActivity: () => lastActivity},
                async () => {
                    await host.session.interrupt({sessionID, resume: false})
                },
            )
            messages = await readSessionContext(host, sessionID)
            if (options?.isAborted?.()) {
                result = {
                    ok: false,
                    message: t('agent.stopped'),
                    error: {code: 'aborted', message: t('agent.stopped')},
                } as unknown as TResult
                break
            }
            if (waited.reason) {
                result = profile.fallback?.(input, state, 'timeout') ?? null
                if (!result) {
                    result = {
                        ok: false,
                        message:
                            waited.reason === 'idle'
                                ? t('agent.idleTimeout', {count: Math.round(idleMs / 60000)})
                                : t('agent.responseTimeout', {ms: timeoutMs}),
                        error: {code: 'timeout', message: waited.reason},
                    } as unknown as TResult
                }
                break
            }
            result = profile.result(input, state, messages, round)
            if (result) break
        }

        if (!result) {
            result =
                profile.fallback?.(input, state, 'max-rounds') ??
                ({
                    ok: false,
                    message: t('agent.maxRounds'),
                    error: {code: 'no_result', message: 'no_result'},
                } as unknown as TResult)
        }
        return buildOutcome(result)
    } catch (error: any) {
        const mapped = profile.onError?.(input, state, error) || errorResult(error)
        if (!messages.length && sessionID) messages = await readSessionContext(host, sessionID)
        return buildOutcome(mapped)
    } finally {
        stopProgress?.()
        options?.onAbortHandle?.(null)
        await profile.teardown?.(input, state)
        await closeHost(host)
    }
}
