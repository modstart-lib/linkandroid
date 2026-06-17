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
