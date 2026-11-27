<script setup lang="ts">
import {computed, nextTick, onMounted, onUnmounted, ref, watch} from 'vue'
import {t} from '../../lang'
import {Dialog} from '../../lib/dialog'
import {mapModelError, useModelStore} from '../../module/Model/store/model'
import {useUserStore} from '../../store/modules/user'
import ModelSelector from '../../module/Model/ModelSelector.vue'
import LoginRequiredDialog from '../../components/common/LoginRequiredDialog.vue'
import LLMRechargeDialog from '../../components/common/LLMRechargeDialog.vue'
import {StorageUtil} from '../../lib/storage'
import {testActionSet, testActionUnset} from '../../utils/test'
import TaskUpdatePreviewDialog from './TaskUpdatePreviewDialog.vue'
import TaskAgentSessionDialog, {type AgentSessionSnapshot} from './TaskAgentSessionDialog.vue'
import {collectDeviceScreenshotByLa, collectDeviceXmlByLa, runTaskPythonCode} from './TaskRuntime'
import {pythonString} from './TaskChatUtils'
import {buildAgentProvider} from '../../support/agent/agentModel'
import AgentParts from '../../support/agent/AgentParts.vue'
import ChatImageList from '../../support/agent/ChatImageList.vue'
import ChatComposer from '../../support/agent/ChatComposer.vue'
import type {AgentLivePart} from '../../support/agent/types'
import {buildLiveParts, imageParts} from '../../support/agent/types'
import {useChatImages} from '../../support/agent/useChatImages'
import {saveChatImage} from '../../support/agent/chatImageStore'
import {hydrateAgentMessages, storedParts} from '../../support/agent/opencodeParts'
import type {AgentMessageRecord, AgentSessionRecord} from '../../support/agent/agentSession'
import {
    createAgentSession,
    deleteAgentSession,
    insertAgentMessage,
    listAgentSessions,
    loadAgentMessages,
    loadAgentSession,
    updateAgentSession,
} from '../../support/agent/agentSession'

const props = defineProps<{
    currentCode: string
    selectedDeviceId: string
    /** Task uuid; empty for an unsaved task (chat stays in memory) */
    businessId?: string
    taskName?: string
}>()

const emit = defineEmits<{
    updateCode: [code: string]
}>()

interface ChatMessage {
    id: string
    role: 'user' | 'assistant'
    content: string
    timestamp: string
    session?: AgentSessionSnapshot
    parts?: AgentLivePart[]
    live?: boolean
    /** Steps existed in OpenCode but could not be read back */
    stepsMissing?: boolean
}

const messages = ref<ChatMessage[]>([])
const inputText = ref('')
const loading = ref(false)
const {images: chatImages, addFromPaste, addFile, removeImage, clearImages, addDataUrl} = useChatImages()
const currentClientId = ref('')
const canSend = computed(() => !!(inputText.value.trim() || chatImages.value.length) && !loading.value)
const messageContainer = ref<HTMLDivElement | null>(null)
const updatePreviewDialog = ref<InstanceType<typeof TaskUpdatePreviewDialog> | null>(null)
const sessionDialog = ref<InstanceType<typeof TaskAgentSessionDialog> | null>(null)
const loginRequiredDialog = ref<InstanceType<typeof LoginRequiredDialog> | null>(null)
const llmRechargeDialog = ref<InstanceType<typeof LLMRechargeDialog> | null>(null)

const modelStore = useModelStore()
const selectedModel = ref<string>('')
const bizKey = 'task.chat'

const sessions = ref<AgentSessionRecord[]>([])
const activeSessionId = ref(0)
const activeRecord = () => sessions.value.find((item) => item.id === activeSessionId.value) || null

const resolveTestModelValue = (model: string) => {
    const findModel = (value: string) => {
        const [providerId, modelId] = value.split('|')
        for (const p of modelStore.providers) {
            if (p.id === providerId && p.data?.enabled) {
                const m = p.data.models?.find((x) => x.id === modelId)
                if (m?.enabled) return {value}
            }
        }
        return null
    }
    if (model === 'llmpx/default') {
        const target = findModel('buildIn|default')
        if (target) return target
        for (const p of modelStore.providers) {
            if (p.id === 'buildIn' || /llmpx|官方/i.test(p.title)) {
                const m = p.data.models.find((x) => x.id === 'default')
                if (m?.enabled) return {value: `${p.id}|${m.id}`}
            }
        }
        return null
    }
    return findModel(model.replace('/', '|'))
}

onMounted(() => {
    const saved = StorageUtil.get(`ModelGenerator.${bizKey}`, '')
    if (saved) {
        selectedModel.value = saved
    }
    void loadSessions()
    testActionSet('task.chat.newSession', () => doNewSession())
    testActionSet('task.chat.selectSession', (id: number) => onSelectSession(id))
    testActionSet('task.chat.renameSession', (arg: {id: number; title: string}) => {
        const record = sessions.value.find((item) => item.id === Number(arg.id))
        return updateAgentSession(Number(arg.id), {title: String(arg.title || ''), touch: false}).then(() => {
            if (record) record.title = String(arg.title || '')
        })
    })
    testActionSet('task.chat.deleteSession', (id: number) => deleteAgentSession(Number(id)).then(() => loadSessions()))
    testActionSet('task.chat.sessionState', () => ({
        businessId: props.businessId || '',
        activeSessionId: activeSessionId.value,
        messages: messages.value.length,
        sessions: sessions.value.map((item) => ({
            id: item.id,
            title: item.title,
            opencode: item.opencode_session_id,
            count: Number(item.message_count || 0),
        })),
    }))
    testActionSet('task.chat.imageCount', () => chatImages.value.length)
    testActionSet('task.chat.addImage', (url: string) => addDataUrl(String(url || '')))
    testActionSet('task.chat.seedSessionMessages', (arg: {sessionId: number; user: string; assistant: string}) =>
        insertAgentMessage({sessionId: Number(arg.sessionId), role: 'user', content: arg.user}).then(() =>
            insertAgentMessage({sessionId: Number(arg.sessionId), role: 'assistant', content: arg.assistant}),
        ),
    )
})

// 记住任务 AI 选用的模型，自动修复会话需要沿用同一个模型
watch(selectedModel, (value) => {
    if (value) StorageUtil.set(`ModelGenerator.${bizKey}`, value)
})

let msgIdCounter = 0
const genId = () => `chat_${Date.now()}_${++msgIdCounter}`

const timeText = (value: string) => {
    if (!value) return ''
    const time = new Date(value).getTime()
    if (Number.isNaN(time)) return ''
    const date = new Date(time)
    const now = new Date()
    const sameDay =
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
        date.getDate() === now.getDate()
    if (sameDay) return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
    return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const sessionLabel = (session: AgentSessionRecord) => {
    const title = session.title || t('ai.untitled')
    return `${title}（${timeText(session.updated_at)}）`
}

const toItems = (rows: AgentMessageRecord[]): ChatMessage[] =>
    rows.map((row) => ({
        id: `db_${row.id}`,
        role: row.role as 'user' | 'assistant',
        content: row.content || '',
        timestamp: row.created_at,
        parts: storedParts(row.parts),
    }))

const loadSessionMessages = async (sessionId: number) => {
    if (!sessionId) {
        messages.value = []
        return
    }
    const rows = await loadAgentMessages(sessionId)
    if (sessionId !== activeSessionId.value) return
    const items = toItems(rows)
    messages.value = items
    scrollToBottom()

    // Reasoning and tool steps stay in OpenCode and are read back in one request.
    const record = await loadAgentSession(sessionId)
    const hydrated = await hydrateAgentMessages(rows, record?.opencode_session_id || '')
    if (sessionId !== activeSessionId.value) return
    items.forEach((item, index) => {
        const rowId = rows[index].id
        const parts = hydrated.parts[rowId]
        if (parts) item.parts = parts
        else if (hydrated.missing.includes(rowId)) item.stepsMissing = true
    })
    // The hydrated objects are the raw ones; replace the array so the list re-renders.
    messages.value = messages.value.slice()
    scrollToBottom()
}

const loadSessions = async (options: {keepMessages?: boolean} = {}) => {
    if (!props.businessId) {
        sessions.value = []
        activeSessionId.value = 0
        if (!options.keepMessages) messages.value = []
        return
    }
    sessions.value = await listAgentSessions({business: 'task-chat', businessId: props.businessId})
    if (!sessions.value.some((item) => item.id === activeSessionId.value)) {
        activeSessionId.value = sessions.value[0]?.id || 0
    }
    if (activeSessionId.value) {
        await loadSessionMessages(activeSessionId.value)
    } else if (!options.keepMessages) {
        messages.value = []
    }
}

watch(
    () => props.businessId,
    (value, old) => {
        if (value === old) return
        if (!value) {
            sessions.value = []
            activeSessionId.value = 0
            messages.value = []
            return
        }
        // A new task was saved: keep the in-memory chat until the first send replays it.
        void loadSessions({keepMessages: old === ''})
    },
)

const onSelectSession = async (value: number) => {
    activeSessionId.value = Number(value) || 0
    await loadSessionMessages(activeSessionId.value)
}

/** Make sure the task has a stored session row; unsaved tasks stay in memory. */
const ensureSession = async (title: string): Promise<AgentSessionRecord | null> => {
    if (!props.businessId) return null
    const existing = activeRecord()
    if (existing) return existing
    const [providerId, modelId] = (selectedModel.value || '|').split('|')
    const id = await createAgentSession({
        business: 'task-chat',
        businessId: props.businessId,
        title: title.slice(0, 30),
        providerId,
        modelId,
    })
    sessions.value = await listAgentSessions({business: 'task-chat', businessId: props.businessId})
    activeSessionId.value = id
    return sessions.value.find((item) => item.id === id) || null
}

const doNewSession = async () => {
    if (!props.businessId) {
        messages.value = []
        inputText.value = ''
        return 0
    }
    const id = await createAgentSession({business: 'task-chat', businessId: props.businessId})
    sessions.value = await listAgentSessions({business: 'task-chat', businessId: props.businessId})
    activeSessionId.value = id
    messages.value = []
    scrollToBottom()
    return id
}

const doRenameSession = async (id: number, current: string) => {
    const title = await Dialog.prompt(t('ai.renamePlaceholder'), current || '')
    if (!title) return
    const value = title.trim()
    if (!value) return
    await updateAgentSession(id, {title: value, touch: false})
    const record = sessions.value.find((item) => item.id === id)
    if (record) record.title = value
}

const doDeleteSession = async (id: number) => {
    const record = sessions.value.find((item) => item.id === id)
    try {
        await Dialog.confirm(t('ai.deleteConfirm', {name: record?.title || t('ai.untitled')}))
    } catch {
        return
    }
    await deleteAgentSession(id)
    activeSessionId.value = 0
    await loadSessions()
}

const doRenameActive = () => {
    const record = activeRecord()
    if (!record) return
    void doRenameSession(record.id, record.title)
}

const doDeleteActive = () => {
    if (!activeSessionId.value) return
    void doDeleteSession(activeSessionId.value)
}

const addMessage = (role: 'user' | 'assistant', content: string, parts: AgentLivePart[] = []) => {
    const message: ChatMessage = {
        id: genId(),
        role,
        content,
        timestamp: new Date().toISOString(),
        parts,
    }
    messages.value.push(message)
    return message
}

const debugLog = (label: string, data: Record<string, any> = {}) => {
    window.$mapi?.log?.info(`Script.Chat.${label}`, data).catch(() => {})
}

const scrollToBottom = () => {
    nextTick(() => {
        if (messageContainer.value) {
            messageContainer.value.scrollTop = messageContainer.value.scrollHeight
        }
    })
}

const showLoginDialog = () => {
    loginRequiredDialog.value?.show()
}

const showRechargeDialog = () => {
    llmRechargeDialog.value?.show()
}

/**
 * 消息发送前的统一预检函数。
 * 在真正发送消息之前检查各项前置条件，若不满足则弹出对应提示且不发送消息。
 */
const preCheckSend = (providerId: string, modelId: string): boolean => {
    if (!providerId || !modelId) {
        Dialog.tipError(t('hint.selectModel'))
        return false
    }
    const userStore = useUserStore()
    if (providerId === 'buildIn') {
        if (!userStore.user.id) {
            showLoginDialog()
            return false
        }
        const provider = modelStore.providers.find((p) => p.id === providerId)
        if (!provider?.apiUrl) {
            showRechargeDialog()
            return false
        }
        const quota = userStore.data.llmpx?.quota
        if (quota !== undefined && quota <= 0) {
            showRechargeDialog()
            return false
        }
    }
    if (!props.selectedDeviceId) {
        Dialog.tipError(t('hint.selectDeviceFirst'))
        return false
    }
    return true
}

const getXmlInfo = async () => {
    if (!props.selectedDeviceId) {
        return ''
    }
    try {
        return await collectDeviceXmlByLa(props.selectedDeviceId)
    } catch {
        return ''
    }
}

const getScreenshot = async () => {
    if (!props.selectedDeviceId) {
        return ''
    }
    try {
        const image = await collectDeviceScreenshotByLa(props.selectedDeviceId)
        return image ? `data:image/png;base64,${image}` : ''
    } catch {
        return ''
    }
}

const buildDeviceContextScript = (prompt: string, xmlInfo: string, hasScreenshot: boolean) => {
    const xmlPreview = xmlInfo.slice(0, 1200)
    return [
        'import re',
        'import tempfile',
        'import la',
        '',
        'device = la.device()',
        '',
        `user_requirement = '''${pythonString(prompt)}'''`,
        `SCREENSHOT_INCLUDED = ${hasScreenshot ? 'True' : 'False'}`,
        `XML_PREVIEW = '''${pythonString(xmlPreview)}'''`,
        '',
        'device.screenOn()',
        'device.home()',
        'xml = device.dumpHierarchy()',
        'shot_path = tempfile.mktemp(suffix=".png")',
        'device.screenshot(shot_path)',
        'print("xml automation context ok")',
        'print("device=" + device.serial())',
        'print("xml_length=" + str(len(xml)))',
        'print("screenshot_in_prompt=" + str(SCREENSHOT_INCLUDED))',
        'match = re.search(r\'(?:text|content-desc)="([^"]+)"[^>]*bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"\', xml)',
        'if match:',
        '    label = match.group(1)',
        '    x = (int(match.group(2)) + int(match.group(4))) // 2',
        '    y = (int(match.group(3)) + int(match.group(5))) // 2',
        '    print("first_target=" + label + "@" + str(x) + "," + str(y))',
        'else:',
        '    print("first_target=none")',
    ].join('\n')
}

const doSend = async () => {
    await sendPrompt(inputText.value)
}

const doStop = async () => {
    if (!currentClientId.value) return
    await window.$mapi.opencodeAgent.interrupt({clientId: currentClientId.value}).catch(() => {})
}

const addFiles = async (files: File[]) => {
    for (const file of files) await addFile(file)
}

const getDeviceBasicInfo = async () => {
    try {
        const controller = await runTaskPythonCode(
            [
                'import la',
                'device = la.device()',
                'print("serial=" + str(device.serial()))',
                'print("currentPackage=" + str(device.currentPackage()))',
                'print("currentActivity=" + str(device.currentActivity()))',
                'current = device.appCurrent()',
                'print("appCurrentPackage=" + str(current.get("package", "")))',
                'print("appCurrentActivity=" + str(current.get("activity", "")))',
                'print("screen_width=" + str(device.width()))',
                'print("screen_height=" + str(device.height()))',
                'battery = device.battery()',
                'print("battery_level=" + str(battery.get("level", "")))',
            ].join('\n'),
            props.selectedDeviceId,
        )
        return await controller.result()
    } catch (e: any) {
        return t('task.fetchDeviceInfoFailed', {error: e.message || e})
    }
}

const sendPrompt = async (input: string, displayInput?: string) => {
    const text = input.trim()
    if ((!text && chatImages.value.length === 0) || loading.value) return

    const [providerId, modelId] = (selectedModel.value || '|').split('|')
    if (!preCheckSend(providerId, modelId)) return

    const display = displayInput?.trim() || text
    const userImages = chatImages.value.map((image) => image.url)
    const history = messages.value
        .map((m) => ({
            role: m.role,
            content: m.content || (imageParts(m.parts).length ? t('chatImage.placeholder') : ''),
        }))
        .filter((m) => m.content)
    const record = await ensureSession(display || t('chatImage.message'))
    const sessionId = record?.id || 0

    // Screenshots go to disk; the model still receives the inline data URL this turn.
    const userParts: AgentLivePart[] = []
    for (const [index, image] of chatImages.value.entries()) {
        userParts.push({
            key: `user-image-${index}`,
            type: 'image',
            url: sessionId ? await saveChatImage(sessionId, image.url) : image.url,
            name: image.name,
        })
    }

    inputText.value = ''
    clearImages()
    if (sessionId) {
        await insertAgentMessage({sessionId, role: 'user', content: display, parts: JSON.stringify(userParts)})
    }
    addMessage('user', display, userParts)

    const clientId = `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    currentClientId.value = clientId
    const liveMessage = addMessage('assistant', '')
    liveMessage.live = true
    liveMessage.parts = []
    const unsubscribe = window.$mapi.opencodeAgent.onProgress((data) => {
        if (!data || data.clientId !== clientId) return
        const target = messages.value.find((m) => m.id === liveMessage.id)
        if (!target) return
        target.parts = buildLiveParts(data.messages || [])
        scrollToBottom()
    })
    const finishLive = (content: string, result?: any) => {
        liveMessage.live = false
        liveMessage.content = content
        if (result?.messages?.length) {
            liveMessage.session = {
                messages: result.messages,
                requestId: result.requestId,
                durationMs: result.durationMs,
            }
        }
        scrollToBottom()
    }
    scrollToBottom()

    loading.value = true
    const startedAt = Date.now()
    let stage = 'start'
    let turnMessageIds: string[] = []
    try {
        debugLog('ContextStart', {providerId, modelId, promptLength: text.length})
        stage = 'xml'
        const xmlInfo = await getXmlInfo()
        debugLog('XmlReady', {xmlLength: xmlInfo.length, duration: Date.now() - startedAt})
        stage = 'screenshot'
        const screenshot = await getScreenshot()
        debugLog('ScreenshotReady', {hasScreenshot: !!screenshot, duration: Date.now() - startedAt})
        stage = 'deviceInfo'
        const deviceBasicInfo = await getDeviceBasicInfo()
        debugLog('DeviceBasicInfoReady', {infoLength: deviceBasicInfo.length, duration: Date.now() - startedAt})
        stage = 'provider'
        const {provider, providerRecord} = buildAgentProvider(providerId, modelId)
        stage = 'agent'
        const result = await window.$mapi.opencodeAgent.runTaskAgent({
            provider,
            requirement: text,
            currentCode: props.currentCode,
            deviceBasicInfo,
            xmlInfo,
            screenshotDataUrl: screenshot,
            userImages,
            updateReadyMessage: t('task.updateToolReady'),
            deviceId: props.selectedDeviceId,
            clientId,
            // Task exploration + code generation may run long; idle guard still applies.
            timeoutMs: 3600000,
            opencodeSessionId: record?.opencode_session_id || '',
            business: 'task-chat',
            businessId: props.businessId || '',
            title: record?.title || undefined,
            history,
        })
        debugLog('AgentResult', {
            ok: result.ok,
            msg: result.message,
            requestId: result.requestId,
            duration: Date.now() - startedAt,
        })
        turnMessageIds = result.newMessageIds || []
        if (result.opencodeSessionId && record) {
            record.opencode_session_id = result.opencodeSessionId
        }
        if (result.ok && result.code) {
            updatePreviewDialog.value?.show(props.currentCode, result.code)
            finishLive(result.message || t('task.updateToolReady'), result)
        } else {
            const message = result.message || t('task.noUpdateToolCall')
            const mapped =
                providerId === 'buildIn' && providerRecord
                    ? mapModelError(message, providerRecord, result.error?.code)
                    : message
            finishLive(mapped, result)
        }
    } catch (e: any) {
        debugLog('Error', {
            message: e.message || `${e}`,
            stage,
            stack: String(e?.stack || '').slice(0, 2000),
            duration: Date.now() - startedAt,
        })
        finishLive(`Error: ${e.message || e}`)
    } finally {
        unsubscribe()
        currentClientId.value = ''
        loading.value = false
        scrollToBottom()
    }

    // A turn that produced only tool steps still needs its row, otherwise the
    // steps have no anchor when the session is reopened.
    if (sessionId && (liveMessage.content || turnMessageIds.length)) {
        await insertAgentMessage({
            sessionId,
            role: 'assistant',
            content: liveMessage.content,
            opencodeMessageIds: turnMessageIds,
        })
        const needTitle = Boolean(record && !record.title)
        const title = needTitle ? display.slice(0, 30) : record?.title || ''
        await updateAgentSession(sessionId, {
            providerId,
            modelId,
            opencodeSessionId: record?.opencode_session_id || '',
            ...(needTitle ? {title} : {}),
        })
        if (record && !record.title) record.title = title
        sessions.value = await listAgentSessions({business: 'task-chat', businessId: props.businessId || ''})
    }
}

const doClearDialog = async () => {
    if (props.businessId) {
        await doNewSession()
    } else {
        messages.value = []
    }
    inputText.value = ''
    Dialog.tipSuccess(t('task.chatClearDialogDone'))
}

const doCopyDialogLog = async () => {
    const data = {
        timestamp: new Date().toISOString(),
        messageCount: messages.value.length,
        messages: messages.value.map((m) => ({
            role: m.role,
            content: m.content,
            timestamp: m.timestamp,
        })),
    }
    try {
        const filePath = await window.$mapi.file.temp('json', 'chat-dialog-')
        await window.$mapi.file.write(filePath, JSON.stringify(data, null, 2), {isDataPath: false})
        await window.$mapi.app.setClipboardText(filePath)
        Dialog.tipSuccess(t('task.chatLogPathCopied'))
    } catch (e: any) {
        Dialog.tipError(t('task.copyLogFailed', {error: e.message || e}))
    }
}

defineExpose({
    preCheckSend,
    testSetCode: (code: string) => {
        addMessage('assistant', code)
    },
    testPreviewUpdate: (code: string) => {
        updatePreviewDialog.value?.show(props.currentCode, code)
    },
    testShowSession: (session: AgentSessionSnapshot | any[]) => {
        sessionDialog.value?.show(session)
    },
    testGenerateFromDeviceContext: async (prompt: string) => {
        if (!props.selectedDeviceId) {
            throw new Error(t('hint.selectDeviceFirst'))
        }
        const xmlInfo = await getXmlInfo()
        const screenshot = await getScreenshot()
        if (!xmlInfo) {
            throw new Error(t('device.preview.noXmlInfo'))
        }
        if (!screenshot) {
            throw new Error(t('device.preview.noScreenshot'))
        }
        const code = buildDeviceContextScript(prompt, xmlInfo, !!screenshot)
        updatePreviewDialog.value?.show(props.currentCode, code)
        addMessage('assistant', t('device.preview.acquiredXmlScreenshot', {length: xmlInfo.length}))
    },
    testSendPromptByRealModel: async (payload: string | {prompt: string; model?: string}) => {
        const prompt = typeof payload === 'string' ? payload : payload.prompt
        const model = typeof payload === 'string' ? 'llmpx/default' : payload.model || 'llmpx/default'
        const targetModel = resolveTestModelValue(model)
        if (targetModel) {
            selectedModel.value = targetModel.value
        } else {
            throw new Error(`未配置指定模型：${model}`)
        }
        if (!selectedModel.value) {
            throw new Error(t('task.noVisionToolsModel'))
        }
        await sendPrompt(prompt)
    },
    testAssertRealModel: (model: string = 'llmpx/default') => {
        const targetModel = resolveTestModelValue(model)
        if (!targetModel) {
            throw new Error(`未配置指定模型：${model}`)
        }
        return targetModel.value
    },
    clearMessages: () => {
        messages.value = []
    },
    getLastRequirement: () => {
        const last = [...messages.value].reverse().find((m) => m.role === 'user')
        return last?.content || ''
    },
    doClearDialog,
    doCopyDialogLog,
    doNewSession,
    doRenameSession,
    doDeleteSession,
    onSelectSession,
    testSessionState: () => ({
        businessId: props.businessId || '',
        activeSessionId: activeSessionId.value,
        messages: messages.value.length,
        sessions: sessions.value.map((item) => ({
            id: item.id,
            title: item.title,
            opencode: item.opencode_session_id,
            count: Number(item.message_count || 0),
        })),
    }),
    testSeedSessionMessages: async (arg: {sessionId: number; user: string; assistant: string}) => {
        await insertAgentMessage({sessionId: arg.sessionId, role: 'user', content: arg.user})
        await insertAgentMessage({sessionId: arg.sessionId, role: 'assistant', content: arg.assistant})
        if (arg.sessionId === activeSessionId.value) await loadSessionMessages(arg.sessionId)
    },
})

onUnmounted(() => {
    testActionUnset('task.chat.newSession')
    testActionUnset('task.chat.selectSession')
    testActionUnset('task.chat.renameSession')
    testActionUnset('task.chat.deleteSession')
    testActionUnset('task.chat.sessionState')
    testActionUnset('task.chat.seedSessionMessages')
    testActionUnset('task.chat.imageCount')
    testActionUnset('task.chat.addImage')
})

const onPreviewConfirm = (code: string) => {
    emit('updateCode', code)
    Dialog.tipSuccess(t('task.updateApplied'))
}
</script>

<template>
    <div class="flex flex-col h-full min-h-0 bg-gray-50 dark:bg-gray-900">
        <TaskAgentSessionDialog ref="sessionDialog" />
        <div
            v-if="businessId"
            class="shrink-0 flex items-center gap-1.5 px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
        >
            <a-select
                :model-value="activeSessionId"
                class="flex-1 min-w-0"
                :disabled="loading"
                :aria-label="$t('task.chatSelectSession')"
                @change="onSelectSession"
            >
                <a-option v-for="session in sessions" :key="session.id" :value="session.id">
                    {{ sessionLabel(session) }}
                </a-option>
            </a-select>
            <a-button type="text" :aria-label="$t('ai.newSession')" :title="$t('ai.newSession')" @click="doNewSession">
                <template #icon><i-lucide-plus class="w-4 h-4" aria-hidden="true" /></template>
            </a-button>
            <a-button
                type="text"
                :aria-label="$t('ai.rename')"
                :title="$t('ai.rename')"
                :disabled="!activeSessionId"
                @click="doRenameActive"
            >
                <template #icon><i-lucide-pencil class="w-4 h-4" aria-hidden="true" /></template>
            </a-button>
            <a-button
                type="text"
                :aria-label="$t('ai.delete')"
                :title="$t('ai.delete')"
                :disabled="!activeSessionId"
                @click="doDeleteActive"
            >
                <template #icon><i-lucide-trash-2 class="w-4 h-4" aria-hidden="true" /></template>
            </a-button>
        </div>
        <div
            v-else-if="!businessId"
            class="shrink-0 px-3 py-2 border-b border-gray-200 dark:border-gray-700 text-[11px] text-gray-500 dark:text-gray-400"
        >
            {{ $t('task.chatSaveHint') }}
        </div>
        <div ref="messageContainer" class="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-3">
            <div
                v-if="messages.length === 0"
                class="flex flex-col items-center justify-center h-full text-center text-gray-400 dark:text-gray-500 select-none"
            >
                <i-lucide-bot class="text-5xl mb-3 opacity-30" />
                <div class="text-sm">{{ $t('task.chatPlaceholder') }}</div>
            </div>

            <div
                v-for="msg in messages"
                :key="msg.id"
                class="flex"
                :class="msg.role === 'user' ? 'justify-end' : 'justify-start'"
            >
                <div
                    class="max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words"
                    :class="
                        msg.role === 'user'
                            ? 'bg-[var(--color-primary)] text-white rounded-br-none'
                            : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-100 dark:border-gray-700 rounded-bl-none'
                    "
                >
                    <AgentParts v-if="msg.role === 'assistant' && msg.parts?.length" :parts="msg.parts" class="mb-1" />
                    <ChatImageList
                        v-if="msg.role === 'user' && imageParts(msg.parts).length"
                        :images="imageParts(msg.parts)"
                        size="md"
                        class="mb-1"
                    />
                    <div v-if="msg.content">{{ msg.content }}</div>
                    <div
                        v-if="msg.stepsMissing"
                        class="mt-1 text-xs text-gray-400"
                        data-testid="chat-steps-unavailable"
                    >
                        {{ $t('chat.stepsUnavailable') }}
                    </div>
                    <div v-if="msg.live" class="flex items-center gap-2 text-xs text-gray-400 mt-1">
                        <span class="relative flex h-2 w-2">
                            <span
                                class="animate-ping absolute inline-flex h-full w-full rounded-full bg-[rgb(var(--primary-5))] opacity-75"
                            ></span>
                            <span class="relative inline-flex rounded-full h-2 w-2 bg-[var(--color-primary)]"></span>
                        </span>
                        <span>{{ $t('task.chatGenerating') }}</span>
                    </div>
                    <a-button
                        v-if="msg.session"
                        type="text"
                        class="!px-0 text-xs mt-1"
                        @click="sessionDialog?.show(msg.session)"
                    >
                        <template #icon>
                            <i-lucide-message-square class="w-3.5 h-3.5" aria-hidden="true" />
                        </template>
                        {{ $t('task.chatViewMessages', {count: msg.session.messages.length}) }}
                    </a-button>
                </div>
            </div>
        </div>

        <div class="shrink-0 px-3 pb-3 pt-2" @paste="addFromPaste">
            <ChatComposer
                v-model="inputText"
                :images="chatImages"
                :loading="loading"
                :can-send="canSend"
                :placeholder="$t('task.chatPlaceholder')"
                send-test-id="task-chat-send"
                @send="doSend"
                @stop="doStop"
                @remove-image="removeImage"
                @add-files="addFiles"
                @add-data-url="addDataUrl"
            >
                <template #model>
                    <ModelSelector v-model="selectedModel" :filter="(m) => m.caps?.vision" />
                    <a-dropdown trigger="click">
                        <a-button type="text" class="shrink-0" :aria-label="$t('task.chatMoreActions')">
                            <template #icon><i-lucide-ellipsis-vertical /></template>
                        </a-button>
                        <template #content>
                            <a-doption @click="doClearDialog">
                                <template #icon><i-lucide-trash-2 /></template>
                                {{ $t('task.chatClearDialog') }}
                            </a-doption>
                            <a-doption @click="doCopyDialogLog">
                                <template #icon><i-lucide-file-text /></template>
                                {{ $t('task.chatDialogLog') }}
                            </a-doption>
                        </template>
                    </a-dropdown>
                </template>
            </ChatComposer>
        </div>
        <TaskUpdatePreviewDialog ref="updatePreviewDialog" @confirm="onPreviewConfirm" />
        <LoginRequiredDialog ref="loginRequiredDialog" />
        <LLMRechargeDialog ref="llmRechargeDialog" />
    </div>
</template>
