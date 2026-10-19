export type ProviderType = 'openai' // | 'anthropic' | 'gemini' | 'qwenlm' | 'azure-openai'

export type ModelType = 'text' // | 'vision' | 'embedding' | 'reasoning' | 'function_calling'

export type ModelCaps = {
    vision?: boolean
    tools?: boolean
}

export type Model = {
    id: string
    provider: string
    name: string
    label?: string
    group: string
    types: ModelType[]
    caps?: ModelCaps
    enabled: boolean
    editable: boolean
    rate?: number
}

export type Provider = {
    id: string
    type: ProviderType
    logo: string | null
    title: string
    isSystem: boolean
    apiUrl: string
    /**
     * Api version prefix appended to `apiUrl`, `/v1` by default.
     * Use an empty string for providers whose endpoint has no version prefix,
     * and a custom value such as `/v1beta/openai` for providers with a
     * dedicated OpenAI compatible prefix.
     */
    apiPath?: string
    websites: {
        official: string
        docs: string
        models: string
    }
    data: {
        apiKey: string
        apiHost: string
        models: Model[]
        enabled: boolean
    }
    runtime?: {}
}

export type ChatParam = {
    systemPrompt: string | null
    messages?: any[]
    tools?: any[]
    toolChoice?: any
    timeoutMs?: number
}
