<script setup lang="ts">
import {computed, nextTick, onMounted, onUnmounted, ref, watch} from 'vue'
import {t} from '../../lang'
import {Dialog} from '../../lib/dialog'
import {StorageUtil} from '../../lib/storage'
import {testActionSet, testActionUnset} from '../../utils/test'
import ModelSelector from '../../module/Model/ModelSelector.vue'
import {useModelStore} from '../../module/Model/store/model'
import VirtualList from '../../components/common/VirtualList.vue'
import AgentParts from '../agent/AgentParts.vue'
import ChatImageList from '../agent/ChatImageList.vue'
import ChatComposer from '../agent/ChatComposer.vue'
import type {AgentLivePart} from '../agent/types'
import {buildLiveParts, imageParts} from '../agent/types'
import {useChatImages} from '../agent/useChatImages'
import {useDeviceStore} from '../../store/modules/device'
import {EnumDeviceStatus} from '../../types/Device'
import {buildAgentProvider, firstEnabledModel, TASK_CHAT_MODEL_KEY} from '../agent/agentModel'
import type {AgentSessionRecord} from '../agent/agentSession'
import {
    deleteAgentMessages,
    insertAgentMessage,
    loadAgentMessages,
    loadAgentSession,
    refreshAgentSessionSummary,
    updateAgentSession,
} from '../agent/agentSession'
import {saveChatImage} from '../agent/chatImageStore'
import {hydrateAgentMessages, storedParts} from '../agent/opencodeParts'

type ChatItem = {
    id: string
    role: 'user' | 'assistant'
    content: string
    timestamp: string
    parts?: AgentLivePart[]
    live?: boolean
    /** Steps existed in OpenCode but could not be read back */
    stepsMissing?: boolean
}

const props = defineProps<{
    deviceId: string
    sessionId: number
}>()

const emit = defineEmits<{
    changed: []
}>()

const items = ref<ChatItem[]>([])
const inputText = ref('')
const loading = ref(false)
const selectedModel = ref<string>(StorageUtil.get(TASK_CHAT_MODEL_KEY, ''))
const listRef = ref<InstanceType<typeof VirtualList> | null>(null)
const sessionRecord = ref<AgentSessionRecord | null>(null)
const atBottom = ref(true)
const modelStore = useModelStore()
const {images: chatImages, addFromPaste, addFile, removeImage, clearImages, addDataUrl} = useChatImages()
const currentClientId = ref('')
const deviceStore = useDeviceStore()

/** Every phone the AI may target in this turn (names match the device picker). */
const connectedDeviceInfos = computed(() =>
    deviceStore.records
        .filter((device) => device.status === EnumDeviceStatus.CONNECTED)
        .map((device) => ({
            id: device.id,
            name: device.name || String(device.raw?.model || ''),
            model: String(device.raw?.model || ''),
            status: 'online',
        })),
)

const modelLacksVision = computed(() => {
    const [providerId, modelId] = (selectedModel.value || '|').split('|')
    if (!providerId || !modelId) return false
    const provider = modelStore.providers.find((item) => item.id === providerId)
    const model = provider?.data.models.find((item) => item.id === modelId)
    return model?.caps?.vision === false
})

const suggestions = computed(() => [
    t('ai.suggestionSearch'),
    t('ai.suggestionObserve'),
    t('ai.suggestionScreenshot'),
    t('ai.suggestionBrightness'),
])

const hasModel = computed(() => {
    const [providerId, modelId] = (selectedModel.value || '|').split('|')
    return !!(providerId && modelId)
})

const canSend = computed(
    () => (!!inputText.value.trim() || chatImages.value.length > 0) && hasModel.value && !loading.value,
)

const composerNotice = computed(() => {
    if (!hasModel.value) return t('ai.modelRequired')
    if (chatImages.value.length && modelLacksVision.value) return t('chatImage.noVision')
    return ''
})

/** MM-DD HH:mm for older messages, HH:mm for today. */
const timeText = (value: string) => {
    const time = new Date(value).getTime()
    if (Number.isNaN(time)) return ''
    const date = new Date(time)
    const now = new Date()
    const sameDay =
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
        date.getDate() === now.getDate()
    const hm = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
    if (sameDay) return hm
    return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${hm}`
}

const composerRef = ref<InstanceType<typeof ChatComposer> | null>(null)

const doUseSuggestion = (text: string) => {
    inputText.value = text
    void nextTick(() => composerRef.value?.focus?.())
}

const scrollToBottom = () => {
    listRef.value?.scrollToBottom()
}

const loadMessages = async () => {
    const sessionId = props.sessionId
    items.value = []
    sessionRecord.value = null
    if (!sessionId) return
    sessionRecord.value = await loadAgentSession(sessionId)
    if (sessionRecord.value?.provider_id && sessionRecord.value?.model_id) {
        selectedModel.value = `${sessionRecord.value.provider_id}|${sessionRecord.value.model_id}`
    }
    const rows = await loadAgentMessages(sessionId)
    if (sessionId !== props.sessionId) return
    const entries = rows.map((row) => ({
        row,
        item: {
            id: `db_${row.id}`,
            role: row.role,
            content: row.content || '',
            // Stored parts stay for legacy rows; rows with OpenCode ids load theirs below.
            parts: storedParts(row.parts),
            timestamp: row.created_at,
        } as ChatItem,
    }))
    items.value = entries.map((entry) => entry.item)
    scrollToBottom()

    // Reasoning and tool steps live in the OpenCode session; text shows first.
    const hydrated = await hydrateAgentMessages(rows, sessionRecord.value?.opencode_session_id || '')
    if (sessionId !== props.sessionId) return
    for (const entry of entries) {
        const parts = hydrated.parts[entry.row.id]
        if (parts) entry.item.parts = parts
        else if (hydrated.missing.includes(entry.row.id)) entry.item.stepsMissing = true
    }
    // The hydrated objects are the raw ones; replace the array so the list re-renders.
    items.value = items.value.slice()
    scrollToBottom()
}

watch(
    () => props.sessionId,
    () => {
        void loadMessages()
    },
    {immediate: true},
)

watch(selectedModel, (value) => {
    StorageUtil.set(TASK_CHAT_MODEL_KEY, value)
    if (!props.sessionId || !value) return
    const [providerId, modelId] = value.split('|')
    if (!providerId || !modelId) return
    void window.$mapi.db.update('UPDATE agent_chat_session SET provider_id = ?, model_id = ? WHERE id = ?', [
        providerId,
        modelId,
        props.sessionId,
    ])
})

const doSendText = async (rawText: string) => {
    const text = String(rawText || '').trim()
    if ((!text && chatImages.value.length === 0) || loading.value) return
    if (!props.deviceId) {
        Dialog.tipError(t('ai.noDevice'))
        return
    }
    const [providerId, modelId] = (selectedModel.value || '|').split('|')
    if (!providerId || !modelId) {
        Dialog.tipError(t('ai.noModel'))
        return
    }
    const sessionId = props.sessionId
    if (!sessionId) return

    const images = chatImages.value.map((image) => image.url)
    const history = items.value
        .map((item) => ({
            role: item.role,
            content: item.content || (imageParts(item.parts).length ? t('chatImage.placeholder') : ''),
        }))
        .filter((item) => item.content)

    const startedAt = new Date().toISOString()
    // Screenshots go to disk (the model still gets the inline data URL this turn).
    const userParts: AgentLivePart[] = []
    for (const [index, image] of chatImages.value.entries()) {
        userParts.push({
            key: `user-image-${index}`,
            type: 'image',
            url: await saveChatImage(sessionId, image.url),
            name: image.name,
        })
    }
    const userId = await insertAgentMessage({
        sessionId,
        role: 'user',
        content: text,
        parts: JSON.stringify(userParts),
    })
    items.value.push({
        id: `db_${userId.id}`,
        role: 'user',
        content: text,
        timestamp: startedAt,
        parts: userParts,
    })
    await window.$mapi.db.update(
        "UPDATE agent_chat_session SET title = CASE WHEN title = '' THEN ? ELSE title END WHERE id = ?",
        [(text || t('chatImage.message')).slice(0, 30), sessionId],
    )
    inputText.value = ''
    clearImages()
    emit('changed')
    scrollToBottom()
    const liveItem: ChatItem = {
        id: `live_${Date.now()}`,
        role: 'assistant',
        content: '',
        timestamp: startedAt,
        parts: [],
        live: true,
    }
    items.value.push(liveItem)
    scrollToBottom()

    const clientId = `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    currentClientId.value = clientId
    const unsubscribe = window.$mapi.opencodeAgent.onProgress((data) => {
        if (!data || data.clientId !== clientId) return
        liveItem.parts = buildLiveParts(data.messages || [])
        scrollToBottom()
    })

    loading.value = true
    try {
        const {provider} = buildAgentProvider(providerId, modelId)
        const result = await window.$mapi.opencodeAgent.runChatAgent({
            provider,
            history,
            text,
            images,
            deviceId: props.deviceId,
            devices: connectedDeviceInfos.value,
            clientId,
            // Long AI tasks (multi-screen crawl + OCR + file export) can run for
            // a long time; the worker still aborts after 10 minutes without progress.
            timeoutMs: 3600000,
            opencodeSessionId: sessionRecord.value?.opencode_session_id || '',
            business: 'ai-chat',
            businessId: '',
        })
        liveItem.live = false
        liveItem.content = result.ok ? result.message : result.message || t('ai.chatFailed')
        scrollToBottom()
        if (result.opencodeSessionId && result.opencodeSessionId !== sessionRecord.value?.opencode_session_id) {
            await updateAgentSession(sessionId, {opencodeSessionId: result.opencodeSessionId, touch: false})
            if (sessionRecord.value) sessionRecord.value.opencode_session_id = result.opencodeSessionId
        }
        await insertAgentMessage({
            sessionId,
            role: 'assistant',
            content: liveItem.content,
            opencodeMessageIds: result.newMessageIds || [],
        })
        emit('changed')
    } catch (error: any) {
        liveItem.live = false
        liveItem.content = `Error: ${error?.message || error}`
    } finally {
        unsubscribe()
        currentClientId.value = ''
        loading.value = false
        scrollToBottom()
    }
}

const doSend = async () => {
    await doSendText(inputText.value)
}

const doStop = async () => {
    if (!currentClientId.value) return
    await window.$mapi.opencodeAgent.interrupt({clientId: currentClientId.value}).catch(() => {})
}

const addFiles = async (files: File[]) => {
    for (const file of files) await addFile(file)
}

const seedTestMessages = async (count: number) => {
    if (!props.sessionId || count <= 0) return 0
    const now = new Date().toISOString()
    const placeholders = Array.from({length: count}, () => '(?, ?, ?, ?, ?, ?)').join(', ')
    const params: any[] = []
    for (let index = 0; index < count; index++) {
        params.push(props.sessionId, index % 2 ? 'assistant' : 'user', `测试消息 ${index}`, '', '', now)
    }
    await window.$mapi.db.execute(
        `INSERT INTO agent_chat_message (session_id, role, content, parts, opencode_message_ids, created_at) VALUES ${placeholders}`,
        params,
    )
    await refreshAgentSessionSummary(props.sessionId)
    await loadMessages()
    return count
}

/** Seed a conversation that covers every rendered part type/state (test only). */ const seedDemoParts = async () => {
    const sessionId = props.sessionId
    if (!sessionId) return 0
    const rows: Array<{role: 'user' | 'assistant'; content: string; parts: AgentLivePart[]}> = [
        {
            role: 'user',
            content: '打开小红书搜索 modstart，把结果标题告诉我',
            parts: [],
        },
        {
            role: 'assistant',
            content:
                '已经搜索到 8 条结果（前 3 条）：\n1. ModStartBlog 开源个人博客系统\n2. 推荐个好用的 MarkDown 编辑器\n3. DSpace：打造你的数字资产管理系统',
            parts: [
                {
                    key: 'demo-r1',
                    type: 'reasoning',
                    text: '先观察当前界面，确认小红书是否已经在前台；如果没有就启动应用，然后再找右上角的搜索按钮。点击后需要等待搜索页出现，输入关键词并提交。',
                },
                {
                    key: 'demo-t1',
                    type: 'tool',
                    name: 'device_observe',
                    durationMs: 780,
                    status: 'completed',
                    input: {full: false},
                    output: 'package=com.xingin.xhs\nactivity=.index.v2.IndexActivityV2\nxml_length=43816\n--- visible elements ---\ntext= | desc=相册 | id=com.miui.home:id/icon_icon | bounds=[52,782][308,1052] | clickable=true',
                },
                {
                    key: 'demo-t2',
                    type: 'tool',
                    name: 'device_tap',
                    durationMs: 420,
                    status: 'completed',
                    input: {text: '搜索'},
                    output: 'tap_ok=True\npackage=com.xingin.xhs',
                },
                {
                    key: 'demo-t3',
                    type: 'tool',
                    name: 'device_input',
                    durationMs: 610,
                    status: 'completed',
                    input: {text: 'modstart', clear: true},
                    output: 'input_ok=True',
                },
                {
                    key: 'demo-t4',
                    type: 'tool',
                    name: 'device_observe',
                    durationMs: 5000,
                    status: 'error',
                    input: {full: false},
                    output: '工具执行失败：设备操作超时',
                },
                {
                    key: 'demo-t5',
                    type: 'tool',
                    name: 'device_reconnect',
                    durationMs: 300,
                    status: 'completed',
                    input: {},
                    output: 'reconnect_ok=true\npackage=com.xingin.xhs',
                },
                {
                    key: 'demo-t6',
                    type: 'tool',
                    name: 'device_sleep',
                    status: 'completed',
                    input: {seconds: 2},
                    output: 'sleep_done=true',
                    durationMs: 1000,
                },
            ],
        },
    ]
    for (const row of rows) {
        await insertAgentMessage({
            sessionId,
            role: row.role,
            content: row.content,
            parts: JSON.stringify(row.parts),
        })
    }
    await window.$mapi.db.update(
        "UPDATE agent_chat_session SET title = CASE WHEN title = '' THEN ? ELSE title END WHERE id = ?",
        ['打开小红书搜索 modstart', sessionId],
    )
    await loadMessages()
    emit('changed')
    return rows.length
}

/** Seed every rendered part type/tool (test only) so all expanded states can be verified. */
const seedAllParts = async () => {
    const sessionId = props.sessionId
    if (!sessionId) return 0
    await deleteAgentMessages(sessionId)
    await updateAgentSession(sessionId, {opencodeSessionId: '', touch: false})
    const tools: Array<[string, string, any, string, number]> = [
        ['device_observe', 'completed', {full: false}, 'package=com.xingin.xhs\nxml_length=43816', 780],
        ['device_tap', 'completed', {text: '搜索'}, 'tap_ok=True', 420],
        ['device_input', 'completed', {text: 'modstart', clear: true}, 'input_ok=True', 610],
        ['device_key', 'completed', {key: 'home'}, 'key_ok=True', 180],
        ['device_swipe', 'completed', {direction: 'up'}, 'swipe_ok=true', 350],
        ['device_open_app', 'completed', {package: 'com.xingin.xhs'}, 'open_ok=True\npackage=com.xingin.xhs', 1200],
        ['device_app_list', 'completed', {}, 'app_count=86\ncom.xingin.xhs', 450],
        ['device_sleep', 'completed', {seconds: 2}, 'sleep_done=true', 1000],
        ['device_reconnect', 'completed', {}, 'reconnect_ok=true', 300],
        ['device_observe', 'error', {full: false}, '工具执行失败：设备操作超时', 5000],
        ['task_update', 'completed', {code: '完整任务代码'}, 'accepted', 200],
    ]
    const parts: AgentLivePart[] = [
        {
            key: 'all-r1',
            type: 'reasoning',
            text: '先观察界面，再依次验证点击、输入、按键、滑动、启动应用、应用列表、等待与重连。',
        },
        ...tools.map(([name, status, input, output, durationMs], index) => ({
            key: `all-t${index}`,
            type: 'tool' as const,
            name,
            status,
            input,
            output,
            durationMs,
        })),
        {key: 'all-text', type: 'text', text: '以上覆盖了全部工具类型与 text / reasoning / tool 三种 part。'},
    ]
    await insertAgentMessage({sessionId, role: 'user', content: '把所有 part 类型都展开验证一遍'})
    await insertAgentMessage({sessionId, role: 'assistant', content: '', parts: JSON.stringify(parts)})
    await window.$mapi.db.update(
        "UPDATE agent_chat_session SET title = CASE WHEN title = '' THEN ? ELSE title END WHERE id = ?",
        ['全部 Part 类型验证', sessionId],
    )
    await loadMessages()
    emit('changed')
    return parts.length
}

/** 掉进“把代码行当工具名”时，界面应只显示一条汇总提示（测试用）。 */
const seedUnknownToolParts = async () => {
    const sessionId = props.sessionId
    if (!sessionId) return 0
    const codeLines = [
        'import la',
        'device = la.device()',
        'la.sleep(2)',
        'device.pressEnter()',
        'xml = device.dumpHierarchy()',
        'import pytesseract',
    ]
    const parts: AgentLivePart[] = codeLines.map((name, index) => ({
        key: `unknown-${index}`,
        type: 'tool' as const,
        name,
        status: 'error',
        input: {},
        output: `Unknown tool '${name}'`,
        durationMs: 1200 - index * 100,
    }))
    await insertAgentMessage({sessionId, role: 'user', content: '运行后只打印了 init，帮我修复'})
    await insertAgentMessage({sessionId, role: 'assistant', content: '任务代码已更新', parts: JSON.stringify(parts)})
    await window.$mapi.db.update(
        "UPDATE agent_chat_session SET title = CASE WHEN title = '' THEN ? ELSE title END WHERE id = ?",
        ['工具误调用示例', sessionId],
    )
    await loadMessages()
    emit('changed')
    return parts.length
}

onMounted(() => {
    testActionSet('ai.chat.setModel', (value: string) => {
        selectedModel.value = value
    })
    testActionSet('ai.chat.defaultModel', () => firstEnabledModel())
    testActionSet('ai.chat.send', async (text: string) => {
        await doSendText(text)
    })
    testActionSet('ai.chat.sendAsync', (text: string) => {
        void doSendText(text)
    })
    testActionSet('ai.chat.messageCount', () => items.value.length)
    testActionSet('ai.chat.isLoading', () => loading.value)
    testActionSet('ai.chat.seedTestMessages', (count: number) => seedTestMessages(count))
    testActionSet('ai.chat.seedDemoParts', () => seedDemoParts())
    testActionSet('ai.chat.seedAllParts', () => seedAllParts())
    testActionSet('ai.chat.seedUnknownParts', () => seedUnknownToolParts())
    testActionSet('ai.chat.addImage', (url: string) => addDataUrl(String(url || '')))
    testActionSet('ai.chat.imageCount', () => chatImages.value.length)
})

onUnmounted(() => {
    testActionUnset('ai.chat.setModel')
    testActionUnset('ai.chat.defaultModel')
    testActionUnset('ai.chat.send')
    testActionUnset('ai.chat.sendAsync')
    testActionUnset('ai.chat.messageCount')
    testActionUnset('ai.chat.isLoading')
    testActionUnset('ai.chat.seedTestMessages')
    testActionUnset('ai.chat.seedDemoParts')
    testActionUnset('ai.chat.seedAllParts')
    testActionUnset('ai.chat.seedUnknownParts')
    testActionUnset('ai.chat.addImage')
    testActionUnset('ai.chat.imageCount')
})

defineExpose({loadMessages, doSend})
</script>

<template>
    <div class="flex flex-col h-full bg-gray-50 dark:bg-gray-900 select-text">
        <div class="flex-1 min-h-0 relative">
            <div
                v-if="items.length"
                class="pointer-events-none absolute inset-x-0 top-0 z-10 h-8 bg-gradient-to-b from-gray-50 to-transparent dark:from-gray-900"
            ></div>
            <div
                v-if="items.length === 0"
                class="absolute inset-0 flex flex-col items-center justify-center px-6 text-center select-none"
            >
                <i-lucide-bot class="mb-3 text-5xl text-gray-400" />
                <div class="text-base font-semibold text-gray-700 dark:text-gray-200">{{ $t('ai.emptyTitle') }}</div>
                <div class="mt-1 max-w-[26rem] text-xs leading-5 text-gray-400">{{ $t('ai.emptyHint') }}</div>
                <div class="mx-auto mt-5 grid w-full max-w-[22rem] grid-cols-1 gap-2 sm:max-w-[30rem] sm:grid-cols-2">
                    <button
                        v-for="text in suggestions"
                        :key="text"
                        type="button"
                        class="w-full rounded-full border border-gray-300 bg-white px-3 py-1.5 text-center text-xs text-gray-700 transition-colors hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--primary-6))] dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                        @click="doUseSuggestion(text)"
                    >
                        {{ text }}
                    </button>
                </div>
            </div>
            <VirtualList
                v-else
                ref="listRef"
                :items="items"
                :item-key="(item) => item.id"
                :estimated-height="120"
                :gap="12"
                class="h-full px-5 pt-6 pb-4 chat-messages"
                @stick-change="atBottom = $event"
            >
                <template #default="{item}">
                    <div class="mx-auto w-full max-w-[44rem]">
                        <div v-if="item.role === 'user'" class="border-l-2 border-[var(--color-primary)] pl-[24px]">
                            <div class="text-[11px] text-gray-400 mb-1">
                                你<span v-if="item.timestamp" class="ml-1.5 tabular-nums">{{
                                    timeText(item.timestamp)
                                }}</span>
                            </div>
                            <ChatImageList
                                v-if="imageParts(item.parts).length"
                                :images="imageParts(item.parts)"
                                size="md"
                                class="mb-1.5"
                            />
                            <div
                                v-if="item.content"
                                class="whitespace-pre-wrap text-sm leading-relaxed text-gray-800 dark:text-gray-100"
                            >
                                {{ item.content }}
                            </div>
                        </div>
                        <div v-else>
                            <AgentParts v-if="item.parts?.length" :parts="item.parts" />
                            <div
                                v-if="item.content"
                                class="whitespace-pre-wrap pl-[26px] pr-2 text-sm leading-relaxed text-gray-800 dark:text-gray-100"
                                :class="item.parts?.length ? 'mt-3' : ''"
                            >
                                {{ item.content }}
                            </div>
                            <div
                                v-if="item.stepsMissing"
                                class="pl-[26px] pr-2 mt-1 text-xs text-gray-400"
                                data-testid="chat-steps-unavailable"
                            >
                                {{ $t('chat.stepsUnavailable') }}
                            </div>
                            <div
                                v-if="item.live"
                                class="flex items-center gap-2 pl-[26px] pr-2 mt-1 text-xs text-gray-400"
                            >
                                <span class="relative flex h-2 w-2">
                                    <span
                                        class="animate-ping absolute inline-flex h-full w-full rounded-full bg-[rgb(var(--primary-5))] opacity-75"
                                    ></span>
                                    <span
                                        class="relative inline-flex rounded-full h-2 w-2 bg-[var(--color-primary)]"
                                    ></span>
                                </span>
                                <span>{{ $t('task.chatGenerating') }}</span>
                            </div>
                        </div>
                    </div>
                </template>
            </VirtualList>
            <button
                v-if="items.length && !atBottom"
                type="button"
                data-testid="chat-back-to-latest"
                class="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 shadow-md hover:text-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--primary-6))] dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                @click="scrollToBottom"
            >
                <i-lucide-arrow-down class="w-3.5 h-3.5" aria-hidden="true" />
                {{ $t('ai.backToLatest') }}
            </button>
            <div
                v-if="items.length"
                class="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-6 bg-gradient-to-t from-gray-50 to-transparent dark:from-gray-900"
            ></div>
        </div>

        <div class="shrink-0 px-3 pb-3 pt-2">
            <div class="mx-auto w-full max-w-[44rem]" @paste="addFromPaste">
                <ChatComposer
                    ref="composerRef"
                    v-model="inputText"
                    :images="chatImages"
                    :loading="loading"
                    :can-send="canSend"
                    :placeholder="$t('ai.placeholder')"
                    :notice="composerNotice"
                    send-test-id="chat-send"
                    @send="doSend"
                    @stop="doStop"
                    @remove-image="removeImage"
                    @add-files="addFiles"
                    @add-data-url="addDataUrl"
                >
                    <template #model>
                        <ModelSelector v-model="selectedModel" />
                    </template>
                </ChatComposer>
            </div>
        </div>
    </div>
</template>
