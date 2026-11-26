import {ipcRenderer} from 'electron'

export type OpenCodeAgentProvider = {
    type: string
    apiUrl: string
    apiHost: string
    apiPath: string
    apiKey: string
    modelId: string
}

export type OpenCodeChatHistoryItem = {role: 'user' | 'assistant'; content: string}

type AgentBusiness = 'ai-chat' | 'task-chat' | 'task-repair' | 'generate'

type SessionFields = {
    /** Existing OpenCode session to continue (stored on the business record) */
    opencodeSessionId?: string
    business?: AgentBusiness
    businessId?: string
    refId?: string
    title?: string
}

export const runTaskAgent = async (
    input: {
        provider: OpenCodeAgentProvider
        requirement: string
        currentCode: string
        deviceBasicInfo: string
        xmlInfo: string
        screenshotDataUrl?: string
        userImages?: string[]
        updateReadyMessage: string
        failureLog?: string
        deviceId?: string
        clientId?: string
        timeoutMs?: number
    } & SessionFields,
) => {
    return ipcRenderer.invoke('opencodeAgent:runTaskAgent', input)
}

export const runChatAgent = async (
    input: {
        provider: OpenCodeAgentProvider
        history: OpenCodeChatHistoryItem[]
        text: string
        images?: string[]
        deviceId?: string
        devices?: Array<{id: string; name?: string; model?: string; status?: string}>
        clientId?: string
        timeoutMs?: number
    } & SessionFields,
) => {
    return ipcRenderer.invoke('opencodeAgent:runChatAgent', input)
}

export const generateText = async (
    input: {
        provider: OpenCodeAgentProvider
        prompt: string
        systemPrompt?: string
        timeoutMs?: number
    } & SessionFields,
) => {
    return ipcRenderer.invoke('opencodeAgent:generateText', input)
}

/** Delete one OpenCode session (called after the business record is deleted). */
export const sessionRemove = async (input: {opencodeSessionId: string}): Promise<{ok: boolean}> => {
    return ipcRenderer.invoke('opencodeAgent:sessionRemove', input)
}

/** Delete every OpenCode session owned by one business record (e.g. a task). */
export const sessionRemoveBusiness = async (input: {
    business: AgentBusiness[]
    businessId: string
}): Promise<{removed: number}> => {
    return ipcRenderer.invoke('opencodeAgent:sessionRemoveBusiness', input)
}

/** List sessions filtered by business (local filter, no server-side support). */
export const sessionList = async (input: {
    business?: AgentBusiness
    businessId?: string
}): Promise<{sessions: Array<{id: string; title: string; metadata?: Record<string, any>}>}> => {
    return ipcRenderer.invoke('opencodeAgent:sessionList', input)
}

/** Read the raw OpenCode messages of one session (view/debug only). */
export const sessionContext = async (input: {opencodeSessionId: string}): Promise<{messages: any[]}> => {
    return ipcRenderer.invoke('opencodeAgent:sessionContext', input)
}

/** Stop the model turn that is currently running; the session stays usable. */
export const interrupt = async (input: {clientId?: string} = {}): Promise<{ok: boolean}> => {
    return ipcRenderer.invoke('opencodeAgent:interrupt', input)
}

/** Live session parts while the agent works; returns an unsubscribe function. */
export const onProgress = (callback: (data: {clientId?: string; messages: any[]}) => void) => {
    const listener = (_event: any, data: any) => callback(data)
    ipcRenderer.on('opencodeAgent:progress', listener)
    return () => {
        ipcRenderer.removeListener('opencodeAgent:progress', listener)
    }
}

export default {
    runTaskAgent,
    runChatAgent,
    interrupt,
    generateText,
    sessionRemove,
    sessionRemoveBusiness,
    sessionList,
    sessionContext,
    onProgress,
}
