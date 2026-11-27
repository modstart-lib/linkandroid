<script setup lang="ts">
import {computed, ref} from 'vue'
import {t} from '../../lang'
import {Dialog} from '../../lib/dialog'

export type AgentSessionSnapshot = {
    messages: any[]
    requestId?: string
    durationMs?: number
}

type TextBlock = {type: 'text' | 'code'; lang?: string; content: string}

const visible = ref(false)
const tab = ref('view')
const expandTools = ref(false)
const session = ref<AgentSessionSnapshot>({messages: []})

const partLabels: Record<string, string> = {
    text: 'agentSession.part.text',
    reasoning: 'agentSession.part.reasoning',
    tool: 'agentSession.part.tool',
    file: 'agentSession.part.file',
    patch: 'agentSession.part.patch',
    snapshot: 'agentSession.part.snapshot',
}

const finishLabels: Record<string, string> = {
    'tool-calls': 'agentSession.finish.toolCalls',
    stop: 'agentSession.finish.stop',
    error: 'agentSession.finish.error',
}

const eventLabels: Record<string, string> = {
    'model-switched': 'agentSession.event.modelSwitched',
    'agent-switched': 'agentSession.event.agentSwitched',
    'location-switched': 'agentSession.event.locationSwitched',
    idle: 'agentSession.event.idle',
}

const partLabel = (type: string) => (partLabels[type] ? t(partLabels[type]) : type)

const show = (value: AgentSessionSnapshot | any[]) => {
    session.value = Array.isArray(value) ? {messages: value} : value
    tab.value = 'view'
    expandTools.value = false
    visible.value = true
}

const messages = computed(() => session.value.messages || [])

const stats = computed(() => {
    const counts: Record<string, number> = {}
    for (const message of messages.value) {
        for (const part of message.content || []) {
            counts[part.type] = (counts[part.type] || 0) + 1
        }
    }
    return counts
})

const statsText = computed(() =>
    Object.entries(stats.value)
        .map(([key, count]) => `${partLabel(key)} ${count}`)
        .join(' · '),
)

const hasTools = computed(() =>
    messages.value.some((message) => (message.content || []).some((part: any) => part.type === 'tool')),
)

const stepIndexes = computed(() => {
    const indexes = new Map<any, number>()
    let step = 0
    for (const message of messages.value) {
        if (message.type === 'assistant') {
            step += 1
            indexes.set(message, step)
        }
    }
    return indexes
})

const lastAssistantIndex = computed(() => {
    for (let i = messages.value.length - 1; i >= 0; i--) {
        if (messages.value[i].type === 'assistant') return i
    }
    return -1
})

const isEvent = (message: any) =>
    ['model-switched', 'agent-switched', 'idle', 'location-switched'].includes(message.type)

const eventLabel = (type: string) => (eventLabels[type] ? t(eventLabels[type]) : type)
const finishLabel = (finish?: string) => (finish ? (finishLabels[finish] ? t(finishLabels[finish]) : finish) : '')

const outcomeLabel = (outcome?: string) => {
    if (outcome === 'succeeded') return t('agentSession.outcome.succeeded')
    if (outcome === 'failed') return t('agentSession.outcome.failed')
    return outcome || ''
}

const roleLabel = (message: any) => {
    if (message.type === 'user') return t('agentSession.role.user')
    if (message.type === 'assistant') return t('agentSession.role.assistant')
    if (message.type === 'system') return t('agentSession.role.system')
    return message.type
}

const formatTime = (value?: number) => {
    if (!value) return ''
    try {
        return new Date(value).toLocaleTimeString(undefined, {hour12: false})
    } catch {
        return ''
    }
}

const stringify = (value: any) => {
    try {
        return JSON.stringify(value, null, 2)
    } catch {
        return String(value)
    }
}

const textBlocks = (text?: string): TextBlock[] => {
    const source = text || ''
    const blocks: TextBlock[] = []
    const pattern = /```([a-zA-Z0-9+#-]*)\r?\n([\s\S]*?)```/g
    let last = 0
    let match: RegExpExecArray | null
    while ((match = pattern.exec(source))) {
        if (match.index > last) {
            blocks.push({type: 'text', content: source.slice(last, match.index)})
        }
        blocks.push({type: 'code', lang: match[1], content: match[2]})
        last = match.index + match[0].length
    }
    if (last < source.length) {
        blocks.push({type: 'text', content: source.slice(last)})
    }
    return blocks.length > 0 ? blocks : [{type: 'text', content: source}]
}

const toolOutput = (part: any) => {
    const state = part.state || {}
    if (state.error) return stringify(state.error)
    const content = state.content
    if (Array.isArray(content)) {
        const text = content
            .map((item: any) => (typeof item === 'string' ? item : item?.text || ''))
            .filter(Boolean)
            .join('\n')
        return text || stringify(content)
    }
    if (typeof content === 'string') return content
    return stringify(state.output || content || '')
}

const toolRejected = (part: any) => /拒绝|reject/i.test(toolOutput(part))

const isToolError = (part: any) => part.state?.status === 'error' || toolRejected(part)

const statusLabel = (part: any) => {
    const status = part.state?.status
    if (status === 'error') return t('agentSession.status.failed')
    if (status === 'running') return t('agentSession.status.running')
    if (status === 'completed')
        return toolRejected(part) ? t('agentSession.status.rejected') : t('agentSession.status.completed')
    return status || t('agentSession.status.unknown')
}

const statusColor = (part: any) => {
    if (isToolError(part)) return 'red'
    const status = part.state?.status
    if (status === 'completed') return 'green'
    if (status === 'running') return 'blue'
    if (status === 'error') return 'red'
    return 'gray'
}

const statusTagClass = (part: any) =>
    isToolError(part)
        ? '!border !border-red-200 dark:!border-red-800 !bg-red-50 dark:!bg-red-950/60 !text-red-700 dark:!text-red-300'
        : ''

const preHeight = () => (expandTools.value ? 'max-h-none' : 'max-h-56')

const doCopyJson = async () => {
    try {
        await window.$mapi.app.setClipboardText(stringify(messages.value))
        Dialog.tipSuccess(t('agentSession.copySuccess'))
    } catch (e: any) {
        Dialog.tipError(t('agentSession.copyFailed', {error: e.message || e}))
    }
}

defineExpose({show})
</script>

<template>
    <a-modal v-model:visible="visible" width="95vw" :footer="false" title-align="start">
        <template #title>
            <div class="font-bold">{{ $t('agentSession.title') }}</div>
        </template>
        <div style="height: calc(100vh - 15rem)">
            <div class="h-full flex flex-col p-4">
                <div class="flex flex-wrap items-center gap-3 pb-3 border-b border-gray-100 dark:border-gray-700">
                    <a-tag color="arcoblue">{{ $t('agentSession.messagesCount', {count: messages.length}) }}</a-tag>
                    <span v-if="statsText" class="text-xs text-gray-600 dark:text-gray-300">{{ statsText }}</span>
                    <span v-if="session.durationMs" class="text-xs text-gray-500 dark:text-gray-400">
                        {{ $t('agentSession.duration', {duration: (session.durationMs / 1000).toFixed(1)}) }}
                    </span>
                    <span v-if="session.requestId" class="text-xs text-gray-500 dark:text-gray-400">
                        {{ $t('agentSession.requestId', {id: session.requestId}) }}
                    </span>
                    <div class="ml-auto flex items-center gap-2">
                        <a-radio-group v-model="tab" type="button">
                            <a-radio value="view">{{ $t('agentSession.tabView') }}</a-radio>
                            <a-radio value="raw">{{ $t('agentSession.tabRaw') }}</a-radio>
                        </a-radio-group>
                    </div>
                </div>

                <div v-if="tab === 'view' && hasTools" class="flex justify-end pt-2">
                    <a-button type="text" @click="expandTools = !expandTools">
                        <template #icon>
                            <i-lucide-maximize-2 class="w-4 h-4" aria-hidden="true" />
                        </template>
                        {{ expandTools ? $t('agentSession.collapseTools') : $t('agentSession.expandTools') }}
                    </a-button>
                </div>
                <div v-if="tab === 'view'" class="flex-1 overflow-y-auto pt-3">
                    <div
                        v-if="messages.length === 0"
                        class="flex flex-col items-center justify-center h-full text-center text-gray-500 dark:text-gray-400"
                    >
                        <i-lucide-message-square class="text-4xl mb-2 opacity-40" aria-hidden="true" />
                        <div class="text-sm">{{ $t('agentSession.empty') }}</div>
                    </div>

                    <div class="space-y-3">
                        <div v-for="(message, messageIndex) in messages" :key="message.id || messageIndex">
                            <div
                                v-if="isEvent(message)"
                                class="flex items-center gap-2 pl-2 my-1 border-l-2 border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400"
                            >
                                <i-lucide-activity class="w-3.5 h-3.5" aria-hidden="true" />
                                <span>{{ eventLabel(message.type) }}</span>
                                <span v-if="message.outcome">· {{ outcomeLabel(message.outcome) }}</span>
                                <span v-if="message.model"
                                    >· {{ message.model.providerID }}/{{ message.model.id }}</span
                                >
                                <span v-if="message.agent">· {{ message.agent }}</span>
                            </div>

                            <div v-else class="flex gap-3">
                                <div class="flex flex-col items-center pt-2 w-6 shrink-0">
                                    <template v-if="message.type === 'assistant'">
                                        <span
                                            class="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-700 text-[11px] text-gray-600 dark:text-gray-300 flex items-center justify-center"
                                        >
                                            {{ stepIndexes.get(message) }}
                                        </span>
                                        <span class="flex-1 w-px bg-gray-200 dark:bg-gray-700 my-1"></span>
                                    </template>
                                    <span v-else class="w-2 h-2 rounded-full bg-gray-200 dark:bg-gray-600 mt-2"></span>
                                </div>

                                <div
                                    class="flex-1 min-w-0 rounded-xl border border-gray-100 dark:border-gray-600 bg-white dark:bg-gray-800 p-3"
                                >
                                    <div class="flex items-center gap-2">
                                        <a-tag :color="message.type === 'user' ? 'arcoblue' : 'gray'" size="small">
                                            {{ roleLabel(message) }}
                                        </a-tag>
                                        <span class="text-xs text-gray-500 dark:text-gray-400">
                                            {{ formatTime(message.time?.created) }}
                                        </span>
                                        <span v-if="message.finish" class="text-xs text-gray-500 dark:text-gray-400">
                                            · {{ finishLabel(message.finish) }}
                                        </span>
                                    </div>

                                    <div class="mt-2 space-y-2">
                                        <template v-if="message.type === 'user'">
                                            <template
                                                v-for="(block, blockIndex) in textBlocks(message.text)"
                                                :key="blockIndex"
                                            >
                                                <pre
                                                    v-if="block.type === 'code'"
                                                    class="text-xs font-mono whitespace-pre overflow-x-auto rounded bg-gray-50 dark:bg-gray-900 p-2 text-gray-700 dark:text-gray-300"
                                                    >{{ block.content }}</pre
                                                >
                                                <div
                                                    v-else
                                                    class="text-sm whitespace-pre-wrap break-words text-gray-800 dark:text-gray-200"
                                                >
                                                    {{ block.content }}
                                                </div>
                                            </template>
                                        </template>

                                        <template v-for="(part, partIndex) in message.content || []" :key="partIndex">
                                            <template v-if="part.type === 'text'">
                                                <template
                                                    v-for="(block, blockIndex) in textBlocks(part.text)"
                                                    :key="blockIndex"
                                                >
                                                    <pre
                                                        v-if="block.type === 'code'"
                                                        class="text-xs font-mono whitespace-pre overflow-x-auto rounded bg-gray-50 dark:bg-gray-900 p-2 text-gray-700 dark:text-gray-300"
                                                        >{{ block.content }}</pre
                                                    >
                                                    <div
                                                        v-else
                                                        class="text-sm whitespace-pre-wrap break-words text-gray-800 dark:text-gray-200"
                                                    >
                                                        {{ block.content }}
                                                    </div>
                                                </template>
                                            </template>

                                            <div v-else-if="part.type === 'reasoning'">
                                                <details
                                                    class="rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700"
                                                    :open="messageIndex === lastAssistantIndex"
                                                >
                                                    <summary
                                                        class="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 cursor-pointer select-none"
                                                    >
                                                        {{ $t('agentSession.reasoning') }}
                                                    </summary>
                                                    <div
                                                        class="px-3 pb-3 text-xs whitespace-pre-wrap break-words text-gray-600 dark:text-gray-300"
                                                    >
                                                        {{ part.text }}
                                                    </div>
                                                </details>
                                            </div>

                                            <div
                                                v-else-if="part.type === 'tool'"
                                                class="rounded-lg border p-3"
                                                :class="
                                                    isToolError(part)
                                                        ? 'border-red-200 dark:border-red-900/60 bg-red-50/60 dark:bg-red-900/10'
                                                        : 'border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900'
                                                "
                                            >
                                                <div class="flex items-center gap-2">
                                                    <i-lucide-wrench
                                                        class="w-3.5 h-3.5 text-gray-400"
                                                        aria-hidden="true"
                                                    />
                                                    <span class="font-medium text-sm">{{ part.name }}</span>
                                                    <a-tag
                                                        :color="statusColor(part)"
                                                        size="small"
                                                        :class="statusTagClass(part)"
                                                    >
                                                        {{ statusLabel(part) }}
                                                    </a-tag>
                                                </div>
                                                <div class="mt-2 grid grid-cols-1 lg:grid-cols-3 gap-2 items-start">
                                                    <div class="lg:col-span-2 min-w-0">
                                                        <div class="text-xs text-gray-500 dark:text-gray-400 mb-1">
                                                            {{ $t('agentSession.input') }}
                                                        </div>
                                                        <pre
                                                            class="text-xs overflow-y-auto whitespace-pre-wrap break-all rounded bg-white dark:bg-gray-800 p-2 text-gray-700 dark:text-gray-300"
                                                            :class="preHeight()"
                                                            >{{ stringify(part.state?.input) }}</pre
                                                        >
                                                    </div>
                                                    <div class="min-w-0">
                                                        <div class="text-xs text-gray-500 dark:text-gray-400 mb-1">
                                                            {{ $t('agentSession.output') }}
                                                        </div>
                                                        <pre
                                                            class="text-xs overflow-y-auto whitespace-pre-wrap break-words rounded bg-white dark:bg-gray-800 p-2"
                                                            :class="[
                                                                preHeight(),
                                                                isToolError(part)
                                                                    ? 'text-red-600 dark:text-red-400'
                                                                    : 'text-gray-700 dark:text-gray-300',
                                                            ]"
                                                            >{{ toolOutput(part) }}</pre
                                                        >
                                                    </div>
                                                </div>
                                            </div>

                                            <div v-else>
                                                <div class="text-xs text-gray-500 dark:text-gray-400 mb-1">
                                                    {{ partLabel(part.type) }}
                                                </div>
                                                <pre
                                                    class="text-xs overflow-y-auto whitespace-pre-wrap break-words rounded bg-gray-50 dark:bg-gray-900 p-2 text-gray-700 dark:text-gray-300"
                                                    :class="preHeight()"
                                                    >{{ stringify(part) }}</pre
                                                >
                                            </div>
                                        </template>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div v-else class="flex-1 overflow-hidden pt-3 flex flex-col">
                    <div class="flex items-center justify-between pb-2">
                        <span class="text-xs text-gray-500 dark:text-gray-400">{{
                            $t('agentSession.scrollHint')
                        }}</span>
                        <a-button type="text" @click="doCopyJson">
                            <template #icon>
                                <i-lucide-copy class="w-4 h-4" aria-hidden="true" />
                            </template>
                            {{ $t('agentSession.copyJson') }}
                        </a-button>
                    </div>
                    <div class="flex-1 overflow-auto [scrollbar-width:thin]">
                        <pre
                            class="text-xs whitespace-pre rounded bg-gray-50 dark:bg-gray-900 p-3 text-gray-700 dark:text-gray-300"
                            >{{ stringify(messages) }}</pre
                        >
                    </div>
                </div>
            </div>
        </div>
    </a-modal>
</template>
