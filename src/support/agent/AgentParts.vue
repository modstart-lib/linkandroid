<script setup lang="ts">
import {computed, ref} from 'vue'
import type {AgentLivePart} from './types'

const props = defineProps<{
    parts: AgentLivePart[]
}>()

type ToolPart = Extract<AgentLivePart, {type: 'tool'}>
type SinglePart = Extract<AgentLivePart, {type: 'reasoning' | 'text'}>
type Block = {kind: 'single'; key: string; part: SinglePart} | {kind: 'tools'; key: string; parts: ToolPart[]}

const TOOL_LABELS: Record<string, string> = {
    device_list: '手机列表',
    device_observe: '观察界面',
    device_tap: '点击',
    device_input: '输入文字',
    device_key: '按键',
    device_swipe: '滑动',
    device_open_app: '打开应用',
    device_app_list: '应用列表',
    device_sleep: '等待',
    device_reconnect: '重连设备',
    task_update: '提交任务代码',
}

const expanded = ref<Record<string, boolean>>({})
const unknownExpanded = ref(false)

const toggle = (key: string) => {
    expanded.value = {...expanded.value, [key]: !expanded.value[key]}
}

const isKnownTool = (name: string) => Object.prototype.hasOwnProperty.call(TOOL_LABELS, name)

/** 模型偶尔会把代码行当成工具名调用：统一收成一条提示，避免整屏红色失败。 */
const unknownParts = computed(() => props.parts.filter((part) => part.type === 'tool' && !isKnownTool(part.name)))
const unknownSummary = computed(() => {
    const counter: Record<string, number> = {}
    for (const part of unknownParts.value) {
        const name = String((part as ToolPart).name || '').trim()
        if (!name) continue
        counter[name] = (counter[name] || 0) + 1
    }
    return Object.entries(counter).map(([name, count]) => ({name, count}))
})

const blocks = computed<Block[]>(() => {
    const result: Block[] = []
    for (const part of props.parts) {
        // Images on user messages are rendered by the chat bubbles, not here.
        if (part.type === 'image') continue
        if (part.type === 'tool') {
            if (!isKnownTool(part.name)) continue
            const last = result[result.length - 1]
            if (last?.kind === 'tools') {
                last.parts.push(part)
            } else {
                result.push({kind: 'tools', key: `tools-${part.key}`, parts: [part]})
            }
        } else {
            result.push({kind: 'single', key: part.key, part})
        }
    }
    return result
})

const toolLabel = (name: string) => TOOL_LABELS[name] || name

const isFailure = (status: string) => status === 'error' || status === 'failed'
const isRunning = (status: string) => status === 'running' || status === 'streaming'
const isCompleted = (status: string) => status === 'completed'
const failedCount = (parts: ToolPart[]) => parts.filter((part) => isFailure(part.status)).length
const runningCount = (parts: ToolPart[]) => parts.filter((part) => isRunning(part.status)).length

const groupState = (parts: ToolPart[]) => {
    if (failedCount(parts)) return 'error'
    if (runningCount(parts)) return 'running'
    return 'completed'
}

const groupDotClass = (parts: ToolPart[]) => {
    const state = groupState(parts)
    if (state === 'error') return 'bg-red-600'
    if (state === 'running') return 'bg-blue-600'
    return 'bg-emerald-600'
}

const statusText = (status: string) => {
    if (isFailure(status)) return '失败'
    if (isRunning(status)) return '执行中'
    return '完成'
}

const formatDuration = (ms?: number) => {
    if (!ms || ms < 0) return ''
    return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
}

const firstLine = (text: string) => (text || '').split('\n')[0].slice(0, 100)

const toolSummary = (part: ToolPart) => {
    const input = part.input || {}
    const device = input.device
        ? String(input.device)
        : Array.isArray(input.devices) && input.devices.length
          ? input.devices.join('、')
          : ''
    for (const key of ['text', 'package', 'desc', 'id', 'direction', 'key', 'seconds', 'x']) {
        const value = input[key]
        if (value !== undefined && value !== null && `${value}` !== '') {
            const text = String(value)
            const action = `${key}=${text.length > 60 ? `${text.slice(0, 60)}…` : text}`
            return device ? `${device} · ${action}` : action
        }
    }
    if (device) return device
    if (part.output) return firstLine(part.output)
    return ''
}

const isKeyValueSummary = (summary: string) => /^[a-z_]+=/.test(summary)

const inputEntries = (part: ToolPart) =>
    Object.keys(part.input || {})
        .filter((key) => part.input[key] !== undefined && part.input[key] !== null && `${part.input[key]}` !== '')
        .map((key) => ({key, value: String(part.input[key])}))
</script>

<template>
    <div class="space-y-1.5 select-text">
        <div v-if="unknownParts.length" data-testid="agent-unknown-tools">
            <button
                type="button"
                class="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-left text-xs bg-amber-50/80 dark:bg-amber-900/20 hover:bg-amber-100/80 dark:hover:bg-amber-900/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                :aria-expanded="unknownExpanded"
                @click="unknownExpanded = !unknownExpanded"
            >
                <i-lucide-triangle-alert class="w-3.5 h-3.5 text-amber-500 shrink-0" aria-hidden="true" />
                <span class="font-medium text-amber-700 dark:text-amber-300">
                    无法识别的工具调用 · {{ unknownParts.length }} 次
                </span>
                <span class="flex-1 min-w-0 truncate text-[11px] text-amber-600/80 dark:text-amber-400/80">
                    模型把代码行当成了工具名，已忽略
                </span>
                <i-lucide-chevron-right
                    class="w-3.5 h-3.5 text-amber-500 transition-transform shrink-0"
                    :class="unknownExpanded ? 'rotate-90' : ''"
                    aria-hidden="true"
                />
            </button>
            <div
                v-if="unknownExpanded"
                class="ml-2 mr-1 mt-1 rounded-md border border-amber-200 dark:border-amber-800/60 bg-amber-50/60 dark:bg-amber-900/10 px-2.5 py-2 text-[11px] text-amber-700 dark:text-amber-300 space-y-1"
            >
                <div v-for="item in unknownSummary" :key="item.name" class="font-mono truncate" :title="item.name">
                    {{ item.name }}<span v-if="item.count > 1" class="text-amber-500"> ×{{ item.count }}</span>
                </div>
                <div class="text-amber-600/80 dark:text-amber-400/80 pt-1">
                    可用工具只有观察界面、点击、输入、按键、滑动、打开应用等设备工具和「提交任务代码」。出现这类调用时
                    Agent 会重新提示模型改用正确工具。
                </div>
            </div>
        </div>
        <template v-for="block in blocks" :key="block.key">
            <div v-if="block.kind === 'tools'">
                <div class="flex items-center gap-1.5 pl-[26px] pr-2 pb-0.5 text-[11px] text-gray-400">
                    <span class="w-1.5 h-1.5 rounded-full" :class="groupDotClass(block.parts)"></span>
                    <span>执行过程</span>
                    <span>·</span>
                    <span>{{ block.parts.length }} 步</span>
                    <span v-if="failedCount(block.parts)" class="text-red-600 dark:text-red-400">
                        · {{ failedCount(block.parts) }} 失败
                    </span>
                    <span v-else-if="runningCount(block.parts)" class="text-blue-600 dark:text-blue-400">
                        · 执行中
                    </span>
                    <span v-else class="text-emerald-600 dark:text-emerald-400">· 完成</span>
                </div>
                <div v-for="part in block.parts" :key="part.key">
                    <button
                        type="button"
                        class="group w-full flex flex-wrap items-center gap-1.5 pl-1.5 pr-2 py-1.5 rounded-md text-left text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                        :class="
                            isFailure(part.status)
                                ? 'bg-red-50/70 dark:bg-red-900/20 hover:bg-red-50 dark:hover:bg-red-900/30'
                                : 'hover:bg-gray-100/70 dark:hover:bg-gray-800/60'
                        "
                        :aria-expanded="!!expanded[part.key]"
                        @click="toggle(part.key)"
                    >
                        <span class="relative w-3.5 h-3.5 shrink-0">
                            <span
                                class="absolute inset-0 transition-opacity"
                                :class="
                                    expanded[part.key]
                                        ? 'opacity-0'
                                        : 'group-hover:opacity-0 group-focus-visible:opacity-0'
                                "
                            >
                                <i-lucide-smartphone
                                    v-if="part.name === 'device_list'"
                                    class="w-3.5 h-3.5 shrink-0"
                                    :class="isFailure(part.status) ? 'text-red-500' : 'text-gray-400'"
                                    aria-hidden="true"
                                />
                                <i-lucide-eye
                                    v-else-if="part.name === 'device_observe'"
                                    class="w-3.5 h-3.5 shrink-0"
                                    :class="isFailure(part.status) ? 'text-red-500' : 'text-gray-400'"
                                    aria-hidden="true"
                                />
                                <i-lucide-mouse-pointer-click
                                    v-else-if="part.name === 'device_tap'"
                                    class="w-3.5 h-3.5 shrink-0"
                                    :class="isFailure(part.status) ? 'text-red-500' : 'text-gray-400'"
                                    aria-hidden="true"
                                />
                                <i-lucide-keyboard
                                    v-else-if="part.name === 'device_input'"
                                    class="w-3.5 h-3.5 shrink-0"
                                    :class="isFailure(part.status) ? 'text-red-500' : 'text-gray-400'"
                                    aria-hidden="true"
                                />
                                <i-lucide-command
                                    v-else-if="part.name === 'device_key'"
                                    class="w-3.5 h-3.5 shrink-0"
                                    :class="isFailure(part.status) ? 'text-red-500' : 'text-gray-400'"
                                    aria-hidden="true"
                                />
                                <i-lucide-move
                                    v-else-if="part.name === 'device_swipe'"
                                    class="w-3.5 h-3.5 shrink-0"
                                    :class="isFailure(part.status) ? 'text-red-500' : 'text-gray-400'"
                                    aria-hidden="true"
                                />
                                <i-lucide-app-window
                                    v-else-if="part.name === 'device_open_app'"
                                    class="w-3.5 h-3.5 shrink-0"
                                    :class="isFailure(part.status) ? 'text-red-500' : 'text-gray-400'"
                                    aria-hidden="true"
                                />
                                <i-lucide-layout-list
                                    v-else-if="part.name === 'device_app_list'"
                                    class="w-3.5 h-3.5 shrink-0"
                                    :class="isFailure(part.status) ? 'text-red-500' : 'text-gray-400'"
                                    aria-hidden="true"
                                />
                                <i-lucide-clock
                                    v-else-if="part.name === 'device_sleep'"
                                    class="w-3.5 h-3.5 shrink-0"
                                    :class="isFailure(part.status) ? 'text-red-500' : 'text-gray-400'"
                                    aria-hidden="true"
                                />
                                <i-lucide-refresh-cw
                                    v-else-if="part.name === 'device_reconnect'"
                                    class="w-3.5 h-3.5 shrink-0"
                                    :class="isFailure(part.status) ? 'text-red-500' : 'text-gray-400'"
                                    aria-hidden="true"
                                />
                                <i-lucide-send
                                    v-else-if="part.name === 'task_update'"
                                    class="w-3.5 h-3.5 shrink-0"
                                    :class="isFailure(part.status) ? 'text-red-500' : 'text-gray-400'"
                                    aria-hidden="true"
                                />
                                <i-lucide-wrench
                                    v-else
                                    class="w-3.5 h-3.5 shrink-0"
                                    :class="isFailure(part.status) ? 'text-red-500' : 'text-gray-400'"
                                    aria-hidden="true"
                                />
                            </span>
                            <i-lucide-chevron-right
                                class="absolute inset-0 w-3.5 h-3.5 text-gray-400 transition-all"
                                :class="
                                    expanded[part.key]
                                        ? 'opacity-100 rotate-90'
                                        : 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100'
                                "
                                aria-hidden="true"
                            />
                        </span>
                        <span
                            class="w-[4.5rem] shrink-0 truncate font-medium"
                            :class="
                                isFailure(part.status)
                                    ? 'text-red-700 dark:text-red-300'
                                    : 'text-gray-700 dark:text-gray-200'
                            "
                        >
                            {{ toolLabel(part.name) }}
                        </span>
                        <span class="w-10 shrink-0 flex items-center">
                            <span
                                v-if="isRunning(part.status)"
                                class="px-1 rounded text-[10px] text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/30"
                            >
                                执行中
                            </span>
                            <span
                                v-else-if="isFailure(part.status)"
                                class="px-1 rounded text-[10px] text-red-600 bg-red-100 dark:text-red-300 dark:bg-red-900/40"
                            >
                                失败
                            </span>
                            <i-lucide-check
                                v-else-if="isCompleted(part.status)"
                                class="w-3 h-3 text-emerald-500"
                                aria-label="完成"
                            />
                        </span>
                        <span
                            v-if="toolSummary(part)"
                            class="flex-1 min-w-0 truncate max-md:order-last max-md:min-w-full max-md:pl-[1.25rem]"
                            :class="[
                                isFailure(part.status)
                                    ? 'text-red-600 dark:text-red-300'
                                    : 'text-gray-500 dark:text-gray-300',
                                isKeyValueSummary(toolSummary(part)) ? 'font-mono' : '',
                            ]"
                            :title="toolSummary(part)"
                        >
                            {{ toolSummary(part) }}
                        </span>
                        <span v-else class="flex-1"></span>
                        <span
                            class="w-12 shrink-0 text-right text-[11px] text-gray-400 dark:text-gray-300 tabular-nums max-md:hidden"
                        >
                            {{ formatDuration(part.durationMs) }}
                        </span>
                    </button>
                    <div
                        v-if="expanded[part.key]"
                        class="ml-[26px] mr-2 mb-2 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 overflow-hidden"
                    >
                        <div
                            class="flex items-center gap-2 px-3 py-1.5 text-[11px] text-gray-500 border-b border-gray-200/70 dark:border-gray-700/60"
                        >
                            <span class="font-medium text-gray-700 dark:text-gray-200">{{ toolLabel(part.name) }}</span>
                            <span>{{ statusText(part.status) }}</span>
                            <span v-if="part.durationMs">{{ formatDuration(part.durationMs) }}</span>
                            <span class="flex-1"></span>
                            <button
                                type="button"
                                class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded"
                                @click="toggle(part.key)"
                            >
                                收起
                            </button>
                        </div>
                        <div class="px-3 py-2 space-y-1.5 text-xs">
                            <div class="text-gray-500">
                                <span class="text-gray-400">工具：</span>{{ toolLabel(part.name) }}
                                <span class="text-gray-400">（{{ part.name }}）</span>
                            </div>
                            <div v-if="inputEntries(part).length" class="text-gray-500 break-words">
                                <span class="text-gray-400">参数：</span>
                                <span v-for="entry in inputEntries(part)" :key="entry.key" class="mr-2 inline-block">
                                    {{ entry.key }}={{
                                        entry.value.length > 80 ? `${entry.value.slice(0, 80)}…` : entry.value
                                    }}
                                </span>
                            </div>
                            <div>
                                <div class="text-gray-400 mb-0.5">结果</div>
                                <pre
                                    v-if="part.output"
                                    class="whitespace-pre-wrap break-words max-h-60 overflow-auto rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-2 text-gray-500"
                                    >{{ part.output }}</pre
                                >
                                <div v-else class="text-gray-400">暂无输出</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <template v-else>
                <div v-if="block.part.type === 'reasoning'">
                    <button
                        type="button"
                        class="group w-full flex items-center gap-1.5 pl-1.5 pr-2 py-1.5 rounded-md text-left text-xs hover:bg-gray-100/70 dark:hover:bg-gray-800/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                        :aria-expanded="!!expanded[block.key]"
                        @click="toggle(block.key)"
                    >
                        <span class="relative w-3.5 h-3.5 shrink-0">
                            <span
                                class="absolute inset-0 transition-opacity"
                                :class="
                                    expanded[block.key]
                                        ? 'opacity-0'
                                        : 'group-hover:opacity-0 group-focus-visible:opacity-0'
                                "
                            >
                                <i-lucide-brain class="w-3.5 h-3.5 text-gray-400" aria-hidden="true" />
                            </span>
                            <i-lucide-chevron-right
                                class="absolute inset-0 w-3.5 h-3.5 text-gray-400 transition-all"
                                :class="
                                    expanded[block.key]
                                        ? 'opacity-100 rotate-90'
                                        : 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100'
                                "
                                aria-hidden="true"
                            />
                        </span>
                        <span class="font-medium text-gray-700 dark:text-gray-200">思考</span>
                        <span class="text-[11px] text-gray-400">· {{ block.part.text.length }} 字</span>
                        <span class="flex-1"></span>
                    </button>
                    <div
                        v-if="expanded[block.key]"
                        class="ml-[26px] mr-2 mb-2 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 px-3 py-2 text-xs text-gray-500 dark:text-gray-400 whitespace-pre-wrap max-h-40 overflow-auto"
                    >
                        {{ block.part.text }}
                    </div>
                </div>
                <div v-else class="whitespace-pre-wrap pl-[26px] pr-2 text-sm">{{ block.part.text }}</div>
            </template>
        </template>
    </div>
</template>
