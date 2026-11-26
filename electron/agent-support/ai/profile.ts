/**
 * AI profile: control the connected Android device through device tools.
 * Conversation history lives in the OpenCode session; only a legacy session
 * without a stored id replays its messages on the first turn.
 */
import {createDeviceBridge, type DeviceRuntime} from '../device/bridge'
import {AI_DEVICE_TOOL_NAMES, registerDeviceTools, type AgentDeviceInfo} from '../device/tools'
import {buildAiSystemPrompt} from './prompt'
import {agentWorkspace, replayMessages} from '../../agent/core/session'
import {findProviderFailure, unknownToolCalls} from '../../agent/core/run'
import {loadSdk} from '../../agent/core/provider'
import {HOST_TOOL_NAMES, hostDesktopHint} from '../../agent/core/tools'
import type {AgentProfile, AgentProvider, AgentRunInput} from '../../agent/core/types'

export type ChatHistoryItem = {role: 'user' | 'assistant'; content: string}

export type ChatAgentInput = AgentRunInput & {
    provider: AgentProvider
    /** Legacy history replayed only when the session has no OpenCode id yet */
    history?: ChatHistoryItem[]
    text: string
    /** Pasted screenshots as data URLs (vision input) */
    images?: string[]
    deviceId?: string
    /** Every connected phone at send time; the model may target any of them */
    devices?: AgentDeviceInfo[]
    deviceRuntime?: DeviceRuntime
}

export type ChatAgentResult = {
    ok: boolean
    message: string
    requestId?: string
    durationMs?: number
    messages?: any[]
    error?: {code?: string; message: string}
}

const describeHistory = (history?: ChatHistoryItem[]) => {
    const recent = (history || []).slice(-10)
    if (recent.length === 0) return ''
    return [
        '=== 之前的对话 ===',
        ...recent.map(
            (item) => `${item.role === 'user' ? '用户' : '助手'}：${String(item.content || '').slice(0, 2000)}`,
        ),
        '',
    ].join('\n')
}

const lastReplyText = (messages: any[]) => {
    for (let index = messages.length - 1; index >= 0; index--) {
        const message = messages[index]
        if (message?.type !== 'assistant' || !Array.isArray(message.content)) continue
        const text = message.content
            .filter((part: any) => part?.type === 'text')
            .map((part: any) => String(part.text || ''))
            .join('\n')
            .trim()
        if (text) return text
    }
    return ''
}

export const aiProfile: AgentProfile<ChatAgentInput, ChatAgentResult> = {
    id: 'ai',

    business: (input) => input.business || 'ai-chat',

    maxRounds: () => 2,

    timeoutMs: () => 3600000,

    title: (input) => {
        const summary = String(input.text || '')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 24)
        return summary ? `控制手机 · ${summary}` : '控制手机'
    },

    createState: () => ({retryText: '', allowedTools: new Set<string>(), replayed: false}),

    plugin: async (input, state) => {
        const {Plugin} = await loadSdk()
        const devices = (input.devices || []).filter((device) => device?.id)
        const defaultId = String(input.deviceId || '').trim() || devices[0]?.id || ''
        const deviceList = devices.some((device) => device.id === defaultId)
            ? devices
            : defaultId
              ? [{id: defaultId, status: 'offline'}, ...devices]
              : devices
        const deviceIds = deviceList.map((device) => device.id)
        const bridge =
            defaultId && input.deviceRuntime?.pythonPath
                ? createDeviceBridge(input.deviceRuntime, defaultId, agentWorkspace(input.dataRoot), deviceIds)
                : null
        state.bridge = bridge
        const allowedTools = new Set<string>([...HOST_TOOL_NAMES, ...(bridge ? AI_DEVICE_TOOL_NAMES : [])])
        state.allowedTools = allowedTools
        const desktopHint = hostDesktopHint()
        const systemPrompt = buildAiSystemPrompt(desktopHint, {devices: deviceList, defaultId})

        return Plugin.define({
            id: 'linkandroid-chat',
            async setup(ctx: any) {
                await ctx.tool.transform((editor: any) => {
                    if (bridge) registerDeviceTools(editor, bridge, deviceList, defaultId)
                })
                await ctx.session.hook('context', (event: any) => {
                    for (const key of Object.keys(event.tools || {})) {
                        if (!allowedTools.has(key)) delete event.tools[key]
                    }
                    event.system = [{type: 'text', text: systemPrompt}]
                })
            },
        })
    },

    replay: async (input, state, {host, sessionID}) => {
        try {
            await replayMessages(host, sessionID, input.history || [])
            state.replayed = true
        } catch {
            state.replayed = false
        }
    },

    turn: (input, state, round) => {
        if (round === 0) {
            // Replayed history is already in the session; only the fallback path
            // (synthetic failed) still needs it inside the prompt.
            const prefix = state.replayed ? '' : describeHistory(input.history)
            const request = input.text || '请查看我发来的图片。'
            return {
                text: prefix + '=== 当前请求 ===\n' + request,
                files: input.images?.length
                    ? input.images.map((url, index) => ({
                          uri: url,
                          source: {type: 'inline'},
                          name: `image-${index + 1}.jpg`,
                      }))
                    : undefined,
            }
        }
        return {text: state.retryText || '上一轮没有返回可用内容，请直接用设备工具完成用户请求。'}
    },

    result: (input, state, messages, round) => {
        const failure = findProviderFailure(messages)
        if (failure) {
            return {ok: false, message: failure.message, error: failure}
        }
        const reply = lastReplyText(messages)
        if (reply) return {ok: true, message: reply}
        const allowed = state.allowedTools as Set<string>
        const unknown = unknownToolCalls(messages, allowed)
        if (round === 0 && unknown.count > 0) {
            state.retryText = [
                `你刚才有 ${unknown.count} 次把代码行当成了工具名调用（例如：${unknown.names.join('、')}），这些工具不存在。`,
                `请重新执行：工具名只能是 ${Array.from(allowed).join('、')}。`,
                '直接调用正确的设备工具完成用户请求，不要执行代码或调用其它工具。',
            ].join('\n')
            return null
        }
        return {ok: false, message: '模型没有返回内容'}
    },

    teardown: (_input, state) => {
        ;(state.bridge as {close?: () => void} | undefined)?.close?.()
    },
}
