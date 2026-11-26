/**
 * Task profile: AI editing of LinkAndroid Python tasks, also used for the
 * automatic repair after a failed run (same tools, different scenario text).
 */
import {createDeviceBridge, type DeviceRuntime} from '../device/bridge'
import {DEVICE_TOOL_NAMES, registerDeviceTools} from '../device/tools'
import {buildTaskAgentSystemPrompt, LINKANDROID_TASK_API_PROMPT} from './prompt'
import {buildRequirementFallbackTaskCode, normalizeGeneratedTaskCode, validateTaskCodeByRequirement} from './code'
import {findProviderFailure, unknownToolCalls} from '../../agent/core/run'
import {loadSdk} from '../../agent/core/provider'
import {agentWorkspace, replayMessages} from '../../agent/core/session'
import {HOST_TOOL_NAMES, hostDesktopHint} from '../../agent/core/tools'
import type {AgentProfile, AgentProvider, AgentRunInput} from '../../agent/core/types'

export type TaskAgentInput = AgentRunInput & {
    provider: AgentProvider
    requirement: string
    currentCode: string
    deviceBasicInfo: string
    xmlInfo: string
    screenshotDataUrl?: string
    /** Screenshots pasted by the user, as data URLs */
    userImages?: string[]
    updateReadyMessage: string
    /** Real device output of the failed run, used only to guide the repair prompt */
    failureLog?: string
    deviceId?: string
    deviceRuntime?: DeviceRuntime
    /** Display history replayed into a new session (task chat continuity) */
    history?: Array<{role: 'user' | 'assistant'; content: string}>
}

export type TaskAgentResult = {
    ok: boolean
    code?: string
    message: string
    requestId?: string
    durationMs?: number
    messages?: any[]
    error?: {code?: string; message: string}
}

const MAX_ROUNDS = 3

const screenshotFileUri = (screenshotDataUrl?: string) => {
    const text = (screenshotDataUrl || '').trim()
    if (!text) return null
    const match = text.match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i)
    const mime = match ? match[1] : 'image/png'
    const data = match ? match[2] : text
    return {mime, data}
}

const buildUserText = (input: TaskAgentInput) =>
    [
        '=== 本次生成场景 ===',
        input.failureLog
            ? '用户的任务在真机上运行失败，正在请求 AI 自动修复 Python 自动化任务代码。'
            : '用户正在 LinkAndroid 任务编辑器里请求 AI 修改 Python 自动化任务代码。',
        '本次请求会在真实物理 Android 设备上执行，生成结果必须能直接运行，并通过运行日志验证关键步骤。',
        '',
        `用户需求：${input.requirement}`,
        '',
        '=== 当前任务代码（必须基于此修改，不是重写） ===',
        '```python',
        input.currentCode,
        '```',
        '',
        '=== 当前手机基本信息 ===',
        '```text',
        input.deviceBasicInfo || '未获取到手机基本信息',
        '```',
        '',
        '=== LinkAndroid API 参考 ===',
        LINKANDROID_TASK_API_PROMPT,
        '',
        '=== 当前界面 XML ===',
        '```xml',
        input.xmlInfo || '未获取到 XML 信息',
        '```',
        '',
        '=== 当前截图 ===',
        input.screenshotDataUrl ? '截图已作为图片附件发送，请结合 XML 识别界面状态。' : '未获取到截图。',
        ...(input.userImages?.length ? [`用户另外附带了 ${input.userImages.length} 张图片，请一并参考。`] : []),
        '',
        ...(input.failureLog
            ? [
                  '=== 上一次运行失败日志（真机输出，节选） ===',
                  '```text',
                  input.failureLog.slice(-8000),
                  '```',
                  '请先根据失败日志定位真正原因，修复代码并保留原有功能，再调用 task_update 提交完整代码。',
                  '',
              ]
            : []),
        '=== 开发约束 ===',
        '用户需求可能是自然表达，你需要自行推导合适的 la API、界面观察步骤和输出内容。',
        '代码必须包含能在物理机运行时观察到的关键日志。',
        '必须基于“当前任务代码”修改，保留已有操作步骤。',
        '必须调用 task_update 提交完整 Python 代码，不要用普通文本结束。',
    ].join('\n')

const buildScreenshotFiles = (input: TaskAgentInput) => {
    const files: any[] = []
    const screenshot = screenshotFileUri(input.screenshotDataUrl)
    if (screenshot) {
        files.push({
            uri: `data:${screenshot.mime};base64,${screenshot.data}`,
            source: {type: 'inline'},
            name: 'screen.png',
        })
    }
    for (const [index, url] of (input.userImages || []).entries()) {
        files.push({uri: url, source: {type: 'inline'}, name: `image-${index + 1}.jpg`})
    }
    return files.length ? files : undefined
}

const fallbackResult = (input: TaskAgentInput, message: string): TaskAgentResult | null => {
    const code = normalizeGeneratedTaskCode(buildRequirementFallbackTaskCode(input.requirement))
    if (code && validateTaskCodeByRequirement(code, input.requirement).length === 0) {
        return {ok: true, code, message}
    }
    return null
}

const timeoutFor = (input: TaskAgentInput) => {
    const hasDevice = Boolean(input.deviceId && input.deviceRuntime?.pythonPath)
    return hasDevice ? 3600000 : 600000
}

export const taskProfile: AgentProfile<TaskAgentInput, TaskAgentResult> = {
    id: 'task',

    business: (input) => input.business || (input.failureLog ? 'task-repair' : 'task-chat'),

    maxRounds: () => MAX_ROUNDS,

    timeoutMs: timeoutFor,

    title: (input) => {
        const prefix = input.failureLog ? '任务自动修复' : '任务 AI 修改'
        const summary = String(input.requirement || '')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 24)
        return summary ? `${prefix} · ${summary}` : prefix
    },

    createState: () => ({
        rejected: [] as string[],
        accepted: null as {code: string; message: string} | null,
        replayed: false,
    }),

    plugin: async (input, state, helpers) => {
        const {Plugin} = await loadSdk()
        const bridge =
            input.deviceId && input.deviceRuntime?.pythonPath
                ? createDeviceBridge(input.deviceRuntime, input.deviceId, agentWorkspace(input.dataRoot))
                : null
        state.bridge = bridge
        const allowedTools = new Set(['task_update', ...HOST_TOOL_NAMES, ...(bridge ? DEVICE_TOOL_NAMES : [])])
        state.allowedTools = allowedTools
        const desktopHint = hostDesktopHint()
        const systemPrompt = buildTaskAgentSystemPrompt({tools: Boolean(bridge), desktop: desktopHint})

        return Plugin.define({
            id: 'linkandroid-task',
            async setup(ctx: any) {
                await ctx.tool.transform((editor: any) => {
                    editor.add({
                        name: 'task_update',
                        description: '预览并更新当前 LinkAndroid Python 任务代码。code 必须是完整可运行代码。',
                        options: {codemode: false},
                        input: {
                            type: 'object',
                            properties: {code: {type: 'string'}, message: {type: 'string'}},
                            required: ['code'],
                        },
                        execute: async (toolInput: any) => {
                            const code = normalizeGeneratedTaskCode(toolInput?.code || '')
                            if (!code) return {content: 'task_update 拒绝：code 为空，请重新生成完整 Python 代码。'}
                            const errors = validateTaskCodeByRequirement(code, input.requirement)
                            if (errors.length > 0) {
                                state.rejected.push(code)
                                return {
                                    content: [
                                        'task_update 拒绝：代码未通过本地校验，请修复后再次调用 task_update。',
                                        ...errors,
                                    ].join('\n'),
                                }
                            }
                            state.accepted = {code, message: toolInput?.message || input.updateReadyMessage}
                            // 拿到可用代码后立即结束本轮，避免模型继续无限调用工具导致超时
                            helpers.interrupt()
                            return {content: 'accepted'}
                        },
                    })
                    if (bridge) registerDeviceTools(editor, bridge)
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
            const historyPrefix =
                !state.replayed && input.history?.length
                    ? [
                          '=== 之前的对话 ===',
                          ...input.history
                              .slice(-10)
                              .map(
                                  (item) =>
                                      `${item.role === 'user' ? '用户' : '助手'}：${String(item.content || '').slice(0, 2000)}`,
                              ),
                          '',
                      ].join('\n')
                    : ''
            return {text: historyPrefix + buildUserText(input), files: buildScreenshotFiles(input)}
        }
        const allowed = state.allowedTools as Set<string>
        const unknown = unknownToolCalls(state.messages || [], allowed)
        const text =
            unknown.count > 0
                ? [
                      `上一轮你有 ${unknown.count} 次把代码行当成了工具名调用（例如：${unknown.names.join('、')}），这些工具不存在，调用全部失败。`,
                      `可用工具只有：${Array.from(allowed).join('、')}。`,
                      '不要再执行代码或逐行验证，直接调用 task_update 提交修改后的完整 Python 代码。',
                  ].join('\n')
                : '上一轮没有提交可用的 task_update。必须直接调用 task_update 提交完整 Python 代码，修复校验反馈中的问题。'
        return {text}
    },

    result: (input, state, messages, round) => {
        state.messages = messages
        if (state.accepted) {
            return {ok: true, code: state.accepted.code, message: state.accepted.message}
        }
        const failure = findProviderFailure(messages)
        if (failure) {
            return {ok: false, message: failure.message, error: failure}
        }
        if (state.rejected.length >= 2 && round < MAX_ROUNDS - 1) {
            const fallback = fallbackResult(input, '模型连续生成不可用代码，已切换为本地可运行任务代码。')
            if (fallback) return fallback
        }
        return null
    },

    fallback: (input, state, reason) => {
        if (reason === 'timeout') {
            const fallback = fallbackResult(input, '模型响应超时，已根据需求生成可运行任务代码。')
            if (fallback) return fallback
            return {
                ok: false,
                message: `模型响应超时（${timeoutFor(input)}ms），尚未生成可用任务代码。`,
                error: {code: 'timeout', message: 'timeout'},
            }
        }
        const fallback = fallbackResult(input, '模型未在限定轮次内完成提交，已根据需求生成可运行任务代码。')
        if (fallback) return fallback
        const rejected = (state.rejected as string[]) || []
        return {
            ok: false,
            message: 'Agent 已达到最大轮次，尚未生成可用任务代码。',
            error: {code: 'no_result', message: rejected.slice(-1)[0] || 'no usable code'},
        }
    },

    onError: (input, error) => {
        const timeout = String(error?.message || '')
            .toLowerCase()
            .includes('timeout')
        return timeout ? fallbackResult(input, '模型请求超时，已根据需求生成可运行任务代码。') : null
    },

    teardown: (_input, state) => {
        ;(state.bridge as {close?: () => void} | undefined)?.close?.()
    },
}
