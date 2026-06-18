<script setup lang="ts">
import {nextTick, onMounted, ref} from 'vue'
import {t} from '../../lang'
import {Dialog} from '../../lib/dialog'
import {useModelStore} from '../../module/Model/store/model'
import ModelSelector from '../../module/Model/ModelSelector.vue'
import {StorageUtil} from '../../lib/storage'
import TaskUpdatePreviewDialog from './TaskUpdatePreviewDialog.vue'
import {collectDeviceScreenshotByLa, collectDeviceXmlByLa, runTaskPythonCode} from './TaskRuntime'
import {runTaskCodeAgent as runTaskCodeAgentCore} from './TaskCodeAgent'
import {LINKANDROID_TASK_API_PROMPT} from './TaskChatPrompt'
import {
    normalizeGeneratedTaskCode,
    validateTaskCodeByRequirement,
    buildRequirementFallbackTaskCode,
    extractTargetsFromXml,
    formatUiTargets,
    pythonString,
} from './TaskChatUtils'

const props = defineProps<{
    currentCode: string
    selectedDeviceId: string
}>()

const emit = defineEmits<{
    updateCode: [code: string]
}>()

interface ChatMessage {
    id: string
    role: 'user' | 'assistant'
    content: string
    timestamp: string
    ask?: ChatAsk
}

interface ChatAsk {
    question: string
    options: string[]
    choice: string
    custom: string
    answered: string
    sourcePrompt: string
}

const messages = ref<ChatMessage[]>([])
const inputText = ref('')
const loading = ref(false)
const messageContainer = ref<HTMLDivElement | null>(null)
const updatePreviewDialog = ref<InstanceType<typeof TaskUpdatePreviewDialog> | null>(null)
const customAskChoice = '__custom__'

const modelStore = useModelStore()
const selectedModel = ref<string>('')
const bizKey = 'task.chat'

const resolveTestModelValue = (model: string) => {
    const findModel = (value: string) => {
        const [providerId, modelId] = value.split('|')
        for (const p of modelStore.providers) {
            if (p.id === providerId && p.data.enabled) {
                const m = p.data.models.find((x) => x.id === modelId)
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
})

let msgIdCounter = 0
const genId = () => `chat_${Date.now()}_${++msgIdCounter}`

const addMessage = (role: 'user' | 'assistant', content: string, ask?: ChatAsk) => {
    messages.value.push({
        id: genId(),
        role,
        content,
        timestamp: new Date().toISOString(),
        ask,
    })
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

const parseToolArgs = (value: string) => {
    try {
        return JSON.parse(value || '{}')
    } catch {
        return {}
    }
}

// normalizeGeneratedTaskCode, validateGeneratedTaskCode, validateTaskCodeByRequirement,
// buildRequirementFallbackTaskCode have been moved to TaskChatUtils.ts

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

const buildUserContent = (text: string, xmlInfo: string, screenshot: string) => {
    const content: any[] = [
        {
            type: 'text',
            text: [
                `用户需求：${text}`,
                '',
                '=== 当前任务代码（必须基于此修改，不是重写） ===',
                '```python',
                props.currentCode,
                '```',
                '',
                '=== LinkAndroid API 参考 ===',
                LINKANDROID_TASK_API_PROMPT,
                '',
                '=== 当前界面 XML ===',
                '```xml',
                xmlInfo || '未获取到 XML 信息',
                '```',
                '',
                '=== 开发约束 ===',
                '用户需求可能是自然表达，你需要自行推导合适的 la API、界面观察步骤和输出内容。',
                '不要要求用户提供 API 名称、输出格式或测试标记。',
                '',
                '⚠️ 重点：必须基于"当前任务代码"修改，保留已有操作步骤，在此基础上调整和扩展。禁止丢弃当前代码重写。',
            ].join('\n'),
        },
    ]
    if (screenshot) {
        content.push({
            type: 'image_url',
            image_url: {
                url: screenshot,
            },
        })
        content.push({
            type: 'text',
            text: [
                '最终确认：上面的截图只用于辅助定位，不是任务目标。',
                '如果截图/XML 与用户需求冲突，以用户需求为准；如果需求涉及当前界面，请用工具继续观察，不要臆测。',
            ].join('\n'),
        })
    }
    return content
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
        return `获取手机基本信息失败：${e.message || e}`
    }
}

const sendPrompt = async (input: string, displayInput?: string) => {
    const text = input.trim()
    if (!text || loading.value) return
    inputText.value = ''
    addMessage('user', displayInput?.trim() || text)
    scrollToBottom()

    const [providerId, modelId] = (selectedModel.value || '|').split('|')
    if (!providerId || !modelId) {
        addMessage('assistant', t('hint.selectModel'))
        scrollToBottom()
        return
    }
    if (!props.selectedDeviceId) {
        addMessage('assistant', t('hint.selectDeviceFirst'))
        scrollToBottom()
        return
    }
    const provider = modelStore.providers.find((p) => p.id === providerId)
    if (providerId === 'buildIn' && !provider?.apiUrl) {
        addMessage('assistant', t('error.energyInsufficient'))
        scrollToBottom()
        return
    }

    loading.value = true
    const startedAt = Date.now()
    try {
        debugLog('ContextStart', {providerId, modelId, promptLength: text.length})
        const xmlInfo = await getXmlInfo()
        debugLog('XmlReady', {xmlLength: xmlInfo.length, duration: Date.now() - startedAt})
        const screenshot = await getScreenshot()
        debugLog('ScreenshotReady', {hasScreenshot: !!screenshot, duration: Date.now() - startedAt})
        const deviceBasicInfo = await getDeviceBasicInfo()
        debugLog('DeviceBasicInfoReady', {infoLength: deviceBasicInfo.length, duration: Date.now() - startedAt})
        const result = await runTaskCodeAgentCore({
            providerId,
            modelId,
            requirement: text,
            currentCode: props.currentCode,
            deviceBasicInfo,
            xmlInfo,
            screenshot,
            selectedDeviceId: props.selectedDeviceId,
            chat: (pid, mid, input, options, runtimeOptions) =>
                modelStore.chat(pid, mid, input, options, runtimeOptions),
            collectXml: collectDeviceXmlByLa,
            collectScreenshot: collectDeviceScreenshotByLa,
            runPython: runTaskPythonCode,
            updateReadyMessage: t('task.updateToolReady'),
        })
        debugLog('AgentResult', {
            ok: result.ok,
            msg: result.message,
            requestId: result.requestId,
            duration: Date.now() - startedAt,
        })
        if (result.ask) {
            const options = (result.ask.options || [])
                .map((item) => item.trim())
                .filter((item) => item && item !== '自己填')
            addMessage('assistant', '需要补充信息', {
                question: result.ask.question,
                options,
                choice: options[0] || customAskChoice,
                custom: '',
                answered: '',
                sourcePrompt: text,
            })
        } else if (result.ok && result.code) {
            updatePreviewDialog.value?.show(props.currentCode, result.code)
            addMessage('assistant', result.message || t('task.updateToolReady'))
        } else {
            addMessage('assistant', result.message || t('task.noUpdateToolCall'))
        }
    } catch (e: any) {
        debugLog('Error', {message: e.message || `${e}`, duration: Date.now() - startedAt})
        addMessage('assistant', `Error: ${e.message || e}`)
    } finally {
        loading.value = false
        scrollToBottom()
    }
}

const doClearDialog = () => {
    messages.value = []
    inputText.value = ''
    Dialog.tipSuccess(t('task.chatClearDialogDone'))
}

const doSubmitAsk = async (msg: ChatMessage) => {
    if (!msg.ask) return
    const answer = msg.ask.choice === customAskChoice ? msg.ask.custom.trim() : msg.ask.choice.trim()
    if (!answer || loading.value) return
    msg.ask.answered = answer
    const prompt = [msg.ask.sourcePrompt, '', `用户针对问题「${msg.ask.question}」选择：${answer}`]
        .filter((item) => item)
        .join('\n')
    await sendPrompt(prompt, answer)
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
        Dialog.tipError(`复制对话日志失败: ${e.message || e}`)
    }
}

defineExpose({
    testSetCode: (code: string) => {
        addMessage('assistant', code)
    },
    testPreviewUpdate: (code: string) => {
        updatePreviewDialog.value?.show(props.currentCode, code)
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
    doClearDialog,
    doCopyDialogLog,
})

const onPreviewConfirm = (code: string) => {
    emit('updateCode', code)
    Dialog.tipSuccess(t('task.updateApplied'))
}
</script>

<template>
    <div class="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
        <div ref="messageContainer" class="flex-1 overflow-y-auto px-3 py-3 space-y-3">
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
                    <div v-if="msg.content">{{ msg.content }}</div>
                    <div
                        v-if="msg.ask"
                        class="mt-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3 whitespace-normal"
                    >
                        <div v-if="msg.ask.answered" class="space-y-2">
                            <div class="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                                <i-lucide-check class="w-4 h-4" aria-hidden="true" />
                                <span class="font-medium">已回答</span>
                            </div>
                            <div class="text-gray-800 dark:text-gray-100 whitespace-pre-wrap">
                                {{ msg.ask.question }}
                            </div>
                            <div
                                class="pl-3 border-l-2 border-[rgb(var(--primary-5))] text-gray-600 dark:text-gray-300 whitespace-pre-wrap"
                            >
                                {{ msg.ask.answered }}
                            </div>
                        </div>
                        <div v-else class="space-y-3">
                            <div class="font-medium text-gray-800 dark:text-gray-100 whitespace-pre-wrap">
                                {{ msg.ask.question }}
                            </div>
                            <div class="space-y-2">
                                <button
                                    v-for="(item, index) in msg.ask.options"
                                    :key="item"
                                    class="w-full flex items-start gap-3 p-2 rounded-lg border text-left transition-all"
                                    :class="
                                        msg.ask.choice === item
                                            ? 'border-[rgb(var(--primary-5))] bg-blue-50 dark:bg-blue-900/30'
                                            : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-[rgb(var(--primary-5))]'
                                    "
                                    @click="msg.ask.choice = item"
                                >
                                    <span
                                        class="shrink-0 w-5 h-5 rounded-full border flex items-center justify-center text-xs"
                                        :class="
                                            msg.ask.choice === item
                                                ? 'border-[rgb(var(--primary-5))] bg-[var(--color-primary)] text-white'
                                                : 'border-gray-300 dark:border-gray-500 text-gray-500'
                                        "
                                    >
                                        {{ index + 1 }}
                                    </span>
                                    <span class="flex-1 text-gray-700 dark:text-gray-200">{{ item }}</span>
                                    <i-lucide-check
                                        v-if="msg.ask.choice === item"
                                        class="w-4 h-4 text-[var(--color-primary)] shrink-0"
                                        aria-hidden="true"
                                    />
                                </button>
                                <div
                                    class="flex items-start gap-3 p-2 rounded-lg border transition-all"
                                    :class="
                                        msg.ask.choice === customAskChoice
                                            ? 'border-[rgb(var(--primary-5))] bg-blue-50 dark:bg-blue-900/30'
                                            : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800'
                                    "
                                >
                                    <button
                                        class="shrink-0 w-5 h-5 rounded-full border flex items-center justify-center text-xs"
                                        :class="
                                            msg.ask.choice === customAskChoice
                                                ? 'border-[rgb(var(--primary-5))] bg-[var(--color-primary)] text-white'
                                                : 'border-gray-300 dark:border-gray-500 text-gray-500'
                                        "
                                        @click="msg.ask.choice = customAskChoice"
                                    >
                                        <i-lucide-edit-3 class="w-3 h-3" aria-hidden="true" />
                                    </button>
                                    <a-textarea
                                        v-model="msg.ask.custom"
                                        placeholder="自己填"
                                        class="flex-1"
                                        :auto-size="{minRows: 1, maxRows: 6}"
                                        @focus="msg.ask.choice = customAskChoice"
                                        @input="msg.ask.choice = customAskChoice"
                                    />
                                </div>
                            </div>
                            <a-button
                                type="primary"
                                long
                                :loading="loading"
                                :disabled="
                                    msg.ask.choice === customAskChoice ? !msg.ask.custom.trim() : !msg.ask.choice
                                "
                                @click="doSubmitAsk(msg)"
                            >
                                提交答案
                            </a-button>
                        </div>
                    </div>
                </div>
            </div>

            <div v-if="loading" class="flex justify-start">
                <div
                    class="max-w-[85%] rounded-xl px-3 py-2 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-bl-none flex items-center gap-2"
                >
                    <span class="relative flex h-2 w-2">
                        <span
                            class="animate-ping absolute inline-flex h-full w-full rounded-full bg-[rgb(var(--primary-5))] opacity-75"
                        ></span>
                        <span class="relative inline-flex rounded-full h-2 w-2 bg-[var(--color-primary)]"></span>
                    </span>
                    <span class="text-xs text-gray-400">{{ $t('task.chatGenerating') }}</span>
                </div>
            </div>
        </div>

        <div
            class="shrink-0 px-3 py-2 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 space-y-2"
        >
            <a-textarea
                v-model="inputText"
                :placeholder="$t('task.chatPlaceholder')"
                :auto-size="{minRows: 2, maxRows: 6}"
                class="w-full"
                @keydown.enter.exact.prevent="doSend"
            />
            <div class="flex items-center gap-2">
                <div class="flex-1">
                    <ModelSelector v-model="selectedModel" :filter="(m) => m.caps?.vision" />
                </div>
                <a-button type="primary" :loading="loading" @click="doSend" class="shrink-0">
                    <template #icon><i-lucide-message-square /></template>
                    {{ $t('task.chatSend') }}
                </a-button>
                <a-dropdown trigger="click">
                    <a-button class="shrink-0" aria-label="聊天更多操作">
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
            </div>
        </div>
        <TaskUpdatePreviewDialog ref="updatePreviewDialog" @confirm="onPreviewConfirm" />
    </div>
</template>
