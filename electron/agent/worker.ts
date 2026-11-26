/**
 * OpenCode agent worker. Runs inside an Electron utility process so the SDK
 * stays out of the renderer and its config/home can be isolated. Business
 * requests (AI chat, task AI, generation) are forwarded to agent-support/.
 */
type WorkerRequest = {
    id: string
    kind:
        | 'smoke'
        | 'runTaskAgent'
        | 'runChatAgent'
        | 'generateText'
        | 'sessionRemove'
        | 'sessionRemoveBusiness'
        | 'sessionList'
        | 'sessionContext'
        | 'sessionPrune'
        | 'interrupt'
    payload?: any
}
type WorkerResponse = {id: string; ok: boolean; result?: any; error?: string}

const parentPort = (process as any).parentPort
const respond = (message: WorkerResponse) => parentPort?.postMessage(message)

let queue: Promise<any> = Promise.resolve()
const enqueue = (task: () => Promise<any>) => {
    const result = queue.then(task, task)
    queue = result.then(
        () => undefined,
        () => undefined,
    )
    return result
}

/** The run currently owning the model stream; interrupted out of band. */
let activeAbort: (() => Promise<void>) | null = null
let activeAborted = false

const interruptActive = async () => {
    activeAborted = true
    if (!activeAbort) return {ok: false}
    await activeAbort()
    return {ok: true}
}

const beginRun = () => {
    activeAborted = false
    activeAbort = null
}

const runOptions = (request: WorkerRequest) => ({
    onProgress: (messages: any[]) => parentPort?.postMessage({id: request.id, progress: messages}),
    isAborted: () => activeAborted,
    onAbortHandle: (handle: (() => Promise<void>) | null) => {
        activeAbort = handle
    },
})

/** Host for session-only operations (list/remove/context); no provider needed. */
const withHost = async <T>(dataRoot: string, task: (host: any) => Promise<T>): Promise<T> => {
    const {createAgentHost, closeHost} = await import('./core/run')
    const host = await createAgentHost(dataRoot, [])
    try {
        return await task(host)
    } finally {
        await closeHost(host)
    }
}

const handle = async (request: WorkerRequest) => {
    // Business requests (AI chat / task AI / generation) are owned by the
    // support layer; this worker only keeps the generic process plumbing.
    const support = await import('../agent-support')
    if (support.isSupportRequest(request.kind)) {
        beginRun()
        return await support.runSupportRequest(request.kind, request.payload, runOptions(request))
    }
    switch (request.kind) {
        case 'smoke': {
            const {runSmoke} = await import('./smoke')
            return await runSmoke(request.payload)
        }
        case 'sessionRemove': {
            const {removeSession} = await import('./core/session')
            const removed = await withHost(request.payload?.dataRoot, (host) =>
                removeSession(host, String(request.payload?.opencodeSessionId || '')),
            )
            return {ok: removed}
        }
        case 'sessionRemoveBusiness': {
            const {removeBusinessSessions} = await import('./core/session')
            const removed = await withHost(request.payload?.dataRoot, (host) =>
                removeBusinessSessions(
                    host,
                    request.payload?.business || [],
                    String(request.payload?.businessId || ''),
                ),
            )
            return {removed}
        }
        case 'sessionList': {
            const {filterSessions, listAllSessions} = await import('./core/session')
            const sessions = await withHost(request.payload?.dataRoot, async (host) =>
                filterSessions(await listAllSessions(host), request.payload?.business, request.payload?.businessId),
            )
            return {sessions}
        }
        case 'sessionPrune': {
            const {pruneSessions} = await import('../agent-support/prune')
            const result = await withHost(request.payload?.dataRoot, (host) => pruneSessions(host, request.payload))
            return result
        }
        case 'sessionContext': {
            const {readSessionContext} = await import('./core/session')
            const messages = await withHost(request.payload?.dataRoot, (host) =>
                readSessionContext(host, String(request.payload?.opencodeSessionId || '')),
            )
            return {messages}
        }
        default:
            throw new Error(`Unknown worker request: ${(request as any).kind}`)
    }
}

parentPort?.on('message', (event: any) => {
    const request = (event?.data ?? event) as WorkerRequest
    // Interrupt must bypass the serial queue: the running request owns the queue.
    if (request.kind === 'interrupt') {
        void interruptActive().then(
            (result) => respond({id: request.id, ok: true, result}),
            (error) => respond({id: request.id, ok: false, error: String(error?.stack || error)}),
        )
        return
    }
    void enqueue(() => handle(request)).then(
        (result) => respond({id: request.id, ok: true, result}),
        (error) => respond({id: request.id, ok: false, error: String(error?.stack || error)}),
    )
})
