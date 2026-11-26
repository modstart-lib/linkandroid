import {StorageUtil} from '../../lib/storage'
import {model} from '../../module/Model/store/model'

/** Model last used by the task chat panel (shared by chat + auto repair). */
export const TASK_CHAT_MODEL_KEY = 'ModelGenerator.task.chat'

export type AgentProviderPayload = {
    type: string
    apiUrl: string
    apiHost: string
    apiPath: string
    apiKey: string
    modelId: string
}

export type AgentModelCaps = {vision?: boolean; tools?: boolean}

/**
 * Build the provider payload for `$mapi.opencodeAgent.*` from a `providerId|modelId` pair.
 * The model list may be empty when the store has not been initialised yet.
 */
export const buildAgentProvider = (providerId: string, modelId: string) => {
    const provider = model.providers.find((p) => p.id === providerId)
    const modelItem = provider?.data?.models?.find((m) => m.id === modelId)
    return {
        provider: {
            type: provider?.type || 'openai',
            apiUrl: provider?.apiUrl || '',
            apiHost: provider?.data.apiHost || '',
            apiPath: provider?.apiPath ?? '/v1',
            apiKey: provider?.data.apiKey || '',
            modelId: modelItem?.id || modelId,
        } as AgentProviderPayload,
        providerRecord: provider,
        caps: (modelItem?.caps || {}) as AgentModelCaps,
    }
}

/** Resolve the task chat model from local storage; returns null when it is no longer usable. */
export const resolveTaskChatModel = async () => {
    if (model.providers.length === 0) {
        await model.init()
    }
    const saved = String(StorageUtil.get(TASK_CHAT_MODEL_KEY, '') || '')
    const [providerId, modelId] = saved.split('|')
    if (!providerId || !modelId) return null
    const built = buildAgentProvider(providerId, modelId)
    const provider = built.providerRecord
    if (!provider?.data?.enabled) return null
    const modelItem = provider.data.models?.find((m) => m.id === modelId)
    if (!modelItem?.enabled) return null
    return {providerId, modelId, provider: built.provider, caps: built.caps}
}

/** First enabled provider|model pair with a usable API address. */
export const firstEnabledModel = () => {
    for (const provider of model.providers) {
        if (!provider.data?.enabled) continue
        if (!(provider.data.apiHost || provider.apiUrl)) continue
        for (const item of provider.data.models || []) {
            if (item.enabled) return `${provider.id}|${item.id}`
        }
    }
    return ''
}

/** True when the task chat model can be used for automatic repair. */
export const hasTaskChatModel = async () => Boolean(await resolveTaskChatModel())
