/** Model injection shared by every agent profile. */
import type {AgentProvider} from './types'

export const PROVIDER_ID = 'linkandroid'
export const MODEL_ID = 'fake'
export const DEFAULT_MODEL_PLACEHOLDER = 'fake'

export type SdkModules = {OpenCode: any; Plugin: any; Provider: any; Model: any}

export const loadSdk = async (): Promise<SdkModules> => {
    const sdkPackage = '@opencode/sdk'
    const pluginPackage = '@opencode/plugin'
    const {OpenCode}: any = await import(sdkPackage)
    const {Plugin, Provider, Model}: any = await import(pluginPackage)
    return {OpenCode, Plugin, Provider, Model}
}

export const resolveBaseUrl = (provider: AgentProvider) => {
    let url = (provider.apiHost || '').trim() || (provider.apiUrl || '').trim()
    url = url.replace(/\/+$/, '').replace(/\/chat\/completions(\?.*)?$/i, '')
    if (!url) return ''
    const apiPath = provider.apiPath ?? '/v1'
    if (!/\/v\d+[a-z0-9]*(\/|$)/i.test(url)) {
        url += apiPath
    }
    return url
}

export const createProviderPlugin = async (provider: AgentProvider) => {
    const {Plugin, Provider, Model} = await loadSdk()
    const modelId = provider.modelId || MODEL_ID
    const baseURL = resolveBaseUrl(provider)
    if (!baseURL) {
        throw new Error('模型地址为空')
    }
    return Plugin.define({
        id: 'linkandroid-provider',
        async setup(ctx: any) {
            await ctx.provider.transform((editor: any) => {
                editor.add({
                    info: {
                        ...Provider.Info.empty(Provider.ID.make(PROVIDER_ID)),
                        name: 'LinkAndroid',
                        activation: 'enabled',
                        package: '@opencode/ai/providers/openai-compatible',
                        settings: {baseURL, apiKey: provider.apiKey, timeout: 120000},
                        request: {
                            settings: {},
                            headers: provider.apiKey ? {Authorization: `Bearer ${provider.apiKey}`} : {},
                            body: {},
                        },
                    },
                    models: [
                        {
                            ...Model.Info.default(Provider.ID.make(PROVIDER_ID), Model.ID.make(modelId)),
                            name: modelId,
                        },
                    ],
                })
            })
        },
    })
}
