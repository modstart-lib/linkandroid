/**
 * Business-agnostic contracts for the OpenCode agent core.
 * A profile only declares prompts, tools and completion rules; the core owns
 * host lifecycle, fixed session storage, timeouts and progress.
 */

export type AgentProvider = {
    type: string
    apiUrl: string
    apiHost: string
    apiPath: string
    apiKey: string
    modelId: string
}

/**
 * Business owner id of a session (for example ai-chat or task-chat).
 * The concrete values are defined by the business modules under agent-support/.
 */
export type AgentBusiness = string

export type AgentRunInput = {
    dataRoot: string
    provider: AgentProvider
    /** Business owner of the session; profiles decide the default */
    business?: AgentBusiness
    /** Business record id (task uuid for task businesses) */
    businessId?: string
    /** Optional reference such as a task run id */
    refId?: string
    /** Existing OpenCode session to continue */
    opencodeSessionId?: string
    /** Working directory for a new session; a random one is generated when empty */
    directory?: string
    /** Session title override */
    title?: string
    /** Safety cap for one model turn; a long task may legitimately run for a long time */
    timeoutMs?: number
    /** Abort when the model made no progress for this long (default 10 minutes) */
    idleTimeoutMs?: number
}

export type AgentProfileState = Record<string, any>

export type AgentProfilePluginContext = {
    /** Interrupt the current session turn (used by tools that finish early) */
    interrupt: () => void
}

export type AgentTurn = {text: string; files?: any[]}

export interface AgentProfile<TInput extends AgentRunInput = any, TResult = any> {
    id: string
    business: (input: TInput) => AgentBusiness
    maxRounds: (input: TInput) => number
    timeoutMs: (input: TInput) => number
    title: (input: TInput) => string
    createState: (input: TInput) => AgentProfileState
    /** Build the plugin that registers tools and replaces the system prompt */
    plugin: (input: TInput, state: AgentProfileState, helpers: AgentProfilePluginContext) => Promise<any>
    /** Replay display history into a newly created session (must not trigger model calls) */
    replay?: (input: TInput, state: AgentProfileState, helpers: {host: any; sessionID: string}) => Promise<void>
    /** Prompt for this round (round 0 is the first turn) */
    turn: (input: TInput, state: AgentProfileState, round: number) => AgentTurn
    /** Return a finished result, or null to run another round */
    result: (input: TInput, state: AgentProfileState, messages: any[], round: number) => TResult | null
    /** Result when the run times out or exhausts rounds */
    fallback?: (input: TInput, state: AgentProfileState, reason: 'timeout' | 'max-rounds') => TResult | null
    /** Map an unexpected error into a profile-specific result */
    onError?: (input: TInput, state: AgentProfileState, error: any) => TResult | null
    /** Release profile resources (device bridge, streams) */
    teardown?: (input: TInput, state: AgentProfileState) => void | Promise<void>
}

export type AgentRunOutcome<TResult> = {
    result: TResult
    messages: any[]
    opencodeSessionId: string
    /** Assistant messages created by this run (for lazy part loading later) */
    newMessageIds: string[]
    requestId: string
    durationMs: number
}

export type AgentSessionInfo = {
    id: string
    title: string
    metadata?: Record<string, any>
    created?: number
    updated?: number
}

export type AgentSessionQuery = {
    dataRoot: string
    business?: AgentBusiness
    businessId?: string
}
