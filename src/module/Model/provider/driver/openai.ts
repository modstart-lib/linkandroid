import {ModelChatResult} from '../provider'
import {ChatParam, ProviderType} from '../../types'
import {AbstractModelProvider} from './base'
import {logAiChat, StringUtil} from '../../../../lib/util'

export class OpenAiModelProvider extends AbstractModelProvider {
    constructor(config: {
        type: ProviderType
        url: string
        apiUrl: string
        apiHost: string
        apiKey: string
        [p: string]: any
    }) {
        super(config)
    }

    async chat(prompt: string, chatParam: ChatParam): Promise<ModelChatResult> {
        // this.config.url =  'http://localhost:3000/v1/chat/completions';
        // this.config.apiKey = '';
        chatParam = Object.assign(
            {
                systemPrompt: null,
            },
            chatParam,
        )
        const messages: any[] = []
        if (chatParam.systemPrompt) {
            messages.push({role: 'system', content: chatParam.systemPrompt})
        }
        if (chatParam.messages?.length) {
            messages.push(...chatParam.messages)
        } else {
            messages.push({role: 'user', content: prompt})
        }
        const body: any = {
            model: this.config.modelId,
            messages: messages,
        }
        if (chatParam.tools?.length) {
            body.tools = chatParam.tools
        }
        if (chatParam.toolChoice) {
            body.tool_choice = chatParam.toolChoice
        }
        const timeoutMs = chatParam.timeoutMs || 120000

        const requestId = StringUtil.random(8)
        const requestHeaders = {
            Authorization: `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
        }
        const startTime = Date.now()

        // log request (before sending)
        logAiChat('request', {
            requestId,
            url: this.config.url,
            headers: requestHeaders,
            body,
        })

        let requestBodyStr: string
        try {
            requestBodyStr = JSON.stringify(body)
        } catch (e) {
            logAiChat('error', {
                requestId,
                url: this.config.url,
                headers: requestHeaders,
                body,
                error: `Failed to serialize request body: ${e}`,
            })
            throw `Request serialization failed: ${e}`
        }

        try {
            const controller = new AbortController()
            const timer = setTimeout(() => {
                controller.abort()
            }, timeoutMs)
            const response = await fetch(this.config.url, {
                method: 'POST',
                headers: requestHeaders,
                body: requestBodyStr,
                signal: controller.signal,
            })
            clearTimeout(timer)

            const duration = Date.now() - startTime

            if (!response.ok) {
                const errorText = await response.text()
                logAiChat('error', {
                    requestId,
                    url: this.config.url,
                    headers: requestHeaders,
                    body,
                    status: response.status,
                    statusText: response.statusText,
                    duration,
                    error: `Request failed: ${response.status}\n${errorText}`,
                })
                throw `Request failed: ${response.status}\n${errorText}`
            }

            // check if is json
            if (!response.headers.get('content-type')?.includes('application/json')) {
                const errorText = await response.text()
                logAiChat('error', {
                    requestId,
                    url: this.config.url,
                    headers: requestHeaders,
                    body,
                    status: response.status,
                    statusText: response.statusText,
                    duration,
                    error: `Response is not json: ${response.status}\n${errorText}`,
                })
                throw `Response is not json: ${response.status}\n${errorText}`
            }

            let data: any
            try {
                data = await response.json()
            } catch (e) {
                const rawText = await response.text()
                logAiChat('error', {
                    requestId,
                    url: this.config.url,
                    headers: requestHeaders,
                    body,
                    status: response.status,
                    statusText: response.statusText,
                    duration,
                    error: `Failed to parse response JSON: ${e}, raw: ${rawText.substring(0, 500)}`,
                })
                throw `Failed to parse response JSON: ${e}`
            }

            // log response (success)
            logAiChat('response', {
                requestId,
                url: this.config.url,
                headers: requestHeaders,
                status: response.status,
                statusText: response.statusText,
                duration,
                body: data,
            })

            try {
                const message = data.choices[0].message
                const content = message.content
                return {
                    code: 0,
                    msg: 'ok',
                    data: {
                        content,
                        toolCalls: message.tool_calls || [],
                        _requestId: requestId,
                    },
                }
            } catch (e) {
                throw `Invalid response format: ${JSON.stringify(data)}`
            }
        } catch (e) {
            // 网络异常（如 DNS 解析失败、连接超时等），补充日志
            if (e instanceof DOMException && e.name === 'AbortError') {
                const error = `Request timeout after ${timeoutMs}ms`
                logAiChat('error', {
                    requestId,
                    url: this.config.url,
                    headers: requestHeaders,
                    body,
                    error,
                    duration: Date.now() - startTime,
                })
                throw error
            }
            if (e instanceof TypeError || !(typeof e === 'string')) {
                logAiChat('error', {
                    requestId,
                    url: this.config.url,
                    headers: requestHeaders,
                    body,
                    error: `Network error: ${e instanceof Error ? e.message : e}`,
                    duration: Date.now() - startTime,
                })
            }
            throw e
        }
    }
}
