<script setup lang="ts">
import {computed, nextTick, onMounted, onUnmounted, ref} from 'vue'
import {t} from '../../lang'
import {Dialog} from '../../lib/dialog'
import {mapError} from '../../lib/error'
import {testActionSet, testActionUnset} from '../../utils/test'
import {useDeviceStore} from '../../store/modules/device'
import {EnumDeviceStatus} from '../../types/Device'
import CodeEditor from '../../components/common/CodeEditor.vue'

import TaskDevicePreviewPanel from './TaskDevicePreviewPanel.vue'
import TaskDocPanel from './TaskDocPanel.vue'
import TaskRunDeviceSelectDialog, {type RunDeviceConfig} from './TaskRunDeviceSelectDialog.vue'
import {runTaskPythonCode} from './TaskRuntime'

const emit = defineEmits<{
    update: []
}>()

const visible = ref(false)
const formData = ref<{id: number; name: string; description: string; code: string; language: string}>({
    id: 0,
    name: '',
    description: '',
    code: `import la
device = la.device()

# 1. 返回首页
device.home()
la.sleep(1)

# 2. 启动微信
device.appStart("com.tencent.mm")
la.sleep(3)

# 3. 点开联系人
device.tapText("联系人", timeout=5)`,
    language: 'python',
})
const isEditMode = computed(() => formData.value.id > 0)

// Log area
const showLog = ref(false)
const logContent = ref('')
const isRunning = ref(false)
let runController: {stop: () => void; send: (data: any) => void} | null = null

// Device related
const deviceStore = useDeviceStore()
const selectedDeviceId = ref<string>('')
const runDeviceIds = ref<string[]>([])
const runDeviceConfig = ref<RunDeviceConfig>({
    runMode: 'manual',
    cronExpression: '',
    runOnAllDevices: false,
    deviceIds: [],
})
const rightTab = ref<'preview' | 'chat' | 'docs'>('preview')

const deviceOptions = computed(() => {
    return deviceStore.records
        .filter((d) => d.status === EnumDeviceStatus.CONNECTED)
        .map((d) => ({
            value: d.id,
            label: d.name || d.raw?.model || d.id,
            type: d.type,
            screenshot: d.screenshot,
        }))
})

const show = (record?: any) => {
    if (record) {
        formData.value = {
            id: record.id,
            name: record.name,
            description: record.description || '',
            code: record.code || '',
            language: record.language || 'python',
        }
    } else {
        formData.value = {
            id: 0,
            name: '',
            description: '',
            code: `import la
device = la.device()

# 1. 返回首页
device.home()
la.sleep(1)

# 2. 启动微信
device.appStart("com.tencent.mm")
la.sleep(3)

# 3. 点开联系人
device.tapText("联系人", timeout=5)`,
            language: 'python',
        }
    }
    // Set default device
    if (deviceOptions.value.length > 0 && !selectedDeviceId.value) {
        selectedDeviceId.value = deviceOptions.value[0].value
    }
    if (runDeviceIds.value.length === 0 && selectedDeviceId.value) {
        runDeviceIds.value = [selectedDeviceId.value]
        runDeviceConfig.value.deviceIds = [selectedDeviceId.value]
    }
    visible.value = true
}

const copy = (record: any) => {
    formData.value = {
        id: 0,
        name: record.name ? `${record.name} Copy` : '',
        description: record.description || '',
        code: record.code || '',
        language: record.language || 'python',
    }
    if (deviceOptions.value.length > 0 && !selectedDeviceId.value) {
        selectedDeviceId.value = deviceOptions.value[0].value
    }
    if (runDeviceIds.value.length === 0 && selectedDeviceId.value) {
        runDeviceIds.value = [selectedDeviceId.value]
        runDeviceConfig.value.deviceIds = [selectedDeviceId.value]
    }
    visible.value = true
}


const devicePreviewPanel = ref<InstanceType<typeof TaskDevicePreviewPanel> | null>(null)
const isPreviewLoading = computed(() => {
    const panel = devicePreviewPanel.value as any
    return panel?.loading?.value === true
})

// Device settings dialog ref
const deviceSelectDialog = ref<InstanceType<typeof TaskRunDeviceSelectDialog> | null>(null)

const doSave = async () => {
    if (!formData.value.name.trim()) {
        Dialog.tipError(t('task.nameRequired'))
        return
    }
    const now = new Date().toISOString()
    try {
        if (formData.value.id > 0) {
            await window.$mapi.db.update(
                `UPDATE task SET name = ?, description = ?, code = ?, language = ?, run_mode = ?, cron_expression = ?, updated_at = ? WHERE id = ?`,
                [
                    formData.value.name.trim(),
                    formData.value.description.trim(),
                    formData.value.code,
                    formData.value.language,
                    runDeviceConfig.value.runMode,
                    runDeviceConfig.value.cronExpression,
                    now,
                    formData.value.id,
                ],
            )
        } else {
            const newId = await window.$mapi.db.insert(
                `INSERT INTO task (created_at, updated_at, name, description, code, language, run_mode, cron_expression) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    now,
                    now,
                    formData.value.name.trim(),
                    formData.value.description.trim(),
                    formData.value.code,
                    formData.value.language,
                    runDeviceConfig.value.runMode,
                    runDeviceConfig.value.cronExpression,
                ],
            )
            formData.value.id = Number(newId)
        }
        Dialog.tipSuccess(t('task.saveSuccess'))
        // Keep dialog open; title auto-updates based on id
        emit('update')
    } catch (e) {
        Dialog.tipError(mapError(e))
    }
}

const doShowDeviceSelect = () => {
    deviceSelectDialog.value?.show(runDeviceConfig.value)
}

const saveScheduleConfig = async () => {
    if (formData.value.id > 0) {
        try {
            await window.$mapi.db.update(
                `UPDATE task SET run_mode = ?, cron_expression = ?, updated_at = ? WHERE id = ?`,
                [
                    runDeviceConfig.value.runMode,
                    runDeviceConfig.value.cronExpression,
                    new Date().toISOString(),
                    formData.value.id,
                ],
            )
        } catch (e) {
            // Non-critical, log silently
            console.error('Failed to save schedule config:', e)
        }
    }
}

const onDeviceSelectConfirm = (config: RunDeviceConfig) => {
    runDeviceConfig.value = config
    runDeviceIds.value = config.runOnAllDevices ? [] : [...config.deviceIds]
    selectedDeviceId.value = runDeviceIds.value[0] || selectedDeviceId.value
    // If scheduled mode and task has ID, save immediately
    if (config.runMode === 'scheduled' && formData.value.id > 0) {
        saveScheduleConfig()
    }
}

const onSelectedDeviceChange = (deviceId: string) => {
    runDeviceIds.value = deviceId ? [deviceId] : []
}

const appendLog = (text: string) => {
    logContent.value += text
    nextTick(() => {
        const el = document.querySelector('.task-log-content')
        if (el) el.scrollTop = el.scrollHeight
    })
}

const doClearLog = () => {
    logContent.value = ''
}

const doStopRun = () => {
    if (runController) {
        runController.stop()
        runController = null
    }
}

const doRun = async () => {
    // Always show the log window when clicking debug run
    logContent.value = ''
    showLog.value = true
    isRunning.value = false

    if (runDeviceIds.value.length === 0) {
        const msg = t('hint.selectDeviceFirst')
        appendLog('--- ' + msg + ' ---\n')
        Dialog.tipError(msg)
        return
    }
    if (!formData.value.name.trim()) {
        // Auto-generate a temporary name for debug run
        formData.value.name = t('task.debugRun') + '_' + Date.now()
    }

    isRunning.value = true
    const now = new Date().toISOString()
    try {
        // Save first if needed
        if (formData.value.id === 0) {
            const taskId = await window.$mapi.db.insert(
                `INSERT INTO task (created_at, updated_at, name, description, code, language, run_mode, cron_expression) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    now,
                    now,
                    formData.value.name.trim(),
                    formData.value.description.trim(),
                    formData.value.code,
                    formData.value.language,
                    runDeviceConfig.value.runMode,
                    runDeviceConfig.value.cronExpression,
                ],
            )
            formData.value.id = Number(taskId)
        } else {
            await window.$mapi.db.update(
                `UPDATE task SET name = ?, description = ?, code = ?, language = ?, run_mode = ?, cron_expression = ?, updated_at = ? WHERE id = ?`,
                [
                    formData.value.name.trim(),
                    formData.value.description.trim(),
                    formData.value.code,
                    formData.value.language,
                    runDeviceConfig.value.runMode,
                    runDeviceConfig.value.cronExpression,
                    now,
                    formData.value.id,
                ],
            )
        }

        emit('update')

        const deviceId = runDeviceIds.value[0]
        const controller = await runTaskPythonCode(formData.value.code, deviceId, {
            stdout: (data: string) => {
                appendLog(data)
            },
            stderr: (data: string) => {
                appendLog(data)
            },
            success: () => {
                appendLog('\n--- ' + t('task.runSuccess') + ' ---\n')
                isRunning.value = false
                runController = null
            },
            error: (msg: string) => {
                appendLog('\n--- ' + t('task.statusFailed') + ': ' + msg + ' ---\n')
                isRunning.value = false
                runController = null
            },
            deviceIds: runDeviceIds.value,
            env: {
                LINKANDROID_TASK_ID: `${formData.value.id}`,
                LINKANDROID_TASK_NAME: formData.value.name,
            },
        })
        runController = controller
    } catch (e) {
        isRunning.value = false
        appendLog('\n--- ' + mapError(e) + ' ---\n')
        Dialog.tipError(mapError(e))
    }
}

const fillForm = (
    data: Partial<{name: string; description: string; code: string; language: string; deviceId: string}>,
) => {
    formData.value = {
        ...formData.value,
        ...data,
    }
    if (data.deviceId) {
        selectedDeviceId.value = data.deviceId
        runDeviceIds.value = [data.deviceId]
    }
}



const testPreviewDevice = async () => {
    rightTab.value = 'preview'
    await nextTick()
    await devicePreviewPanel.value?.doPreview()
}

const testSelectFirstLocator = () => {
    rightTab.value = 'preview'
    return devicePreviewPanel.value?.testSelectFirstLocator() || ''
}

const testGetSelectedLocator = () => {
    return devicePreviewPanel.value?.getSelectedLocator() || ''
}

const testGetCode = () => {
    return formData.value.code
}



const onInsertLocator = (code: string) => {
    formData.value.code = `${formData.value.code.trimEnd()}\n\n${code}\n`
}

const close = () => {
    visible.value = false
}

onMounted(() => {
    testActionSet('task.editor.fill', (data: any) => fillForm(data))
    testActionSet('task.editor.save', () => doSave())
    testActionSet('task.editor.run', () => doRun())
    
    testActionSet('task.editor.previewDevice', () => testPreviewDevice())
    testActionSet('task.editor.selectFirstLocator', () => testSelectFirstLocator())
    testActionSet('task.editor.getSelectedLocator', () => testGetSelectedLocator())
    testActionSet('task.editor.getCode', () => testGetCode())
    testActionSet('task.editor.close', () => close())
    testActionSet('task.editor.showDeviceSelect', () => doShowDeviceSelect())
    
})

onUnmounted(() => {
    testActionUnset('task.editor.fill')
    testActionUnset('task.editor.save')
    testActionUnset('task.editor.run')
    
    testActionUnset('task.editor.previewDevice')
    testActionUnset('task.editor.selectFirstLocator')
    testActionUnset('task.editor.getSelectedLocator')
    testActionUnset('task.editor.getCode')
    testActionUnset('task.editor.close')
    testActionUnset('task.editor.showDeviceSelect')
    
})

defineExpose({
    show,
    copy,
    fillForm,
    doSave,
    doRun,
    
    testPreviewDevice,
    testSelectFirstLocator,
    testGetSelectedLocator,
    testGetCode,
    close,
})
</script>

<template>
    <div>
        <a-modal
            v-model:visible="visible"
            width="95vw"
            :footer="false"
            title-align="start"
            :style="{top: '20px', height: 'calc(100vh - 40px)'}"
        >
            <template #title>
                <div class="font-bold">
                    {{ isEditMode ? $t('task.edit') : $t('task.add') }}
                </div>
            </template>
            <div class="-mx-5 -my-6 flex flex-col" style="height: calc(100vh - 110px)">
                <!-- Top toolbar -->
                <div
                    class="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
                >
                    <!-- Script name -->
                    <a-input v-model="formData.name" :placeholder="$t('task.name')" class="w-48" />
                    <div class="w-px h-6 bg-gray-200 dark:bg-gray-700" />
                    <!-- Device selector dropdown -->
                    <a-select
                        v-model="selectedDeviceId"
                        :placeholder="$t('task.selectDevice')"
                        style="min-width: 180px; width: auto"
                        allow-clear
                        :disabled="isPreviewLoading"
                        @change="onSelectedDeviceChange"
                    >
                        <a-option v-for="opt in deviceOptions" :key="opt.value" :value="opt.value">
                            <div class="flex items-center gap-2">
                                <span class="relative flex items-center">
                                    <i-lucide-smartphone v-if="opt.type === 'usb'" class="text-blue-500 text-sm" />
                                    <i-lucide-wifi v-else class="text-green-500 text-sm" />
                                    <span
                                        class="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-green-500 border border-white dark:border-gray-800"
                                    />
                                </span>
                                <span class="truncate">{{ opt.label }}</span>
                            </div>
                        </a-option>
                    </a-select>
                    <!-- Debug run button -->
                    <a-tooltip :content="$t('task.debugRunInfo')">
                        <a-button type="primary" @click="doRun">
                            <template #icon><i-lucide-play /></template>
                            {{ $t('task.debugRun') }}
                        </a-button>
                    </a-tooltip>
                    <div class="flex-1" />
                    <!-- Run device settings -->
                    <a-tooltip :content="$t('task.runDeviceSettingsInfo')">
                        <a-button @click="doShowDeviceSelect">
                            <template #icon><i-lucide-settings /></template>
                            {{ $t('task.runDeviceSettings') }}
                            <span
                                v-if="runDeviceIds.length > 0 || runDeviceConfig.runOnAllDevices"
                                class="ml-1 text-xs bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300 px-1.5 py-0.5 rounded-full"
                            >
                                {{ runDeviceConfig.runOnAllDevices ? $t('common.all') : runDeviceIds.length }}
                            </span>
                        </a-button>
                    </a-tooltip>
                    <!-- Save button -->
                    <a-button type="primary" @click="doSave">
                        <template #icon><i-lucide-check /></template>
                        {{ $t('common.save') }}
                    </a-button>
                </div>

                <!-- Main content: editor + tools -->
                <div class="flex flex-1 overflow-hidden">
                    <div class="w-1/2 flex flex-col overflow-hidden border-r border-gray-200 dark:border-gray-700">
                        <div class="flex-1 min-h-0 overflow-hidden p-2 flex flex-col">
                            <CodeEditor
                                v-model="formData.code"
                                language="python"
                                height="100%"
                                class="flex-1 min-h-0"
                            />
                        </div>
                        <div
                            v-if="showLog"
                            class="shrink-0 border-t border-gray-200 dark:border-gray-700 flex flex-col"
                            style="height: 180px"
                        >
                            <div
                                class="shrink-0 flex items-center justify-between px-4 py-1.5 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700"
                            >
                                <span class="text-xs font-medium text-gray-600 dark:text-gray-400">
                                    <i-lucide-workflow class="inline-block mr-1" />
                                    {{ $t('task.runLog') }}
                                </span>
                                <div class="flex items-center gap-1">
                                    <a-button v-if="isRunning" size="mini" status="danger" @click="doStopRun">
                                        <template #icon><i-lucide-circle-pause /></template>
                                        {{ $t('task.stop') }}
                                    </a-button>
                                    <a-button size="mini" @click="doClearLog">
                                        <template #icon><i-lucide-trash-2 /></template>
                                        {{ $t('task.clearLog') }}
                                    </a-button>
                                    <a-button size="mini" @click="showLog = false">
                                        <template #icon><i-lucide-x /></template>
                                    </a-button>
                                </div>
                            </div>
                            <pre
                                v-if="logContent || isRunning"
                                class="task-log-content flex-1 overflow-auto p-3 text-xs font-mono leading-relaxed m-0 bg-gray-900 text-green-400"
                                style="
                                    white-space: pre-wrap;
                                    word-break: break-all;
                                ">{{ logContent }}<span v-if="isRunning" class="inline-block w-2 h-4 bg-green-400 animate-pulse ml-0.5 align-bottom" /></pre>
                            <div
                                v-else
                                class="task-log-content flex-1 flex items-center justify-center p-3 text-xs font-mono m-0 bg-gray-900 text-gray-500"
                            >
                                {{ $t('task.noLog') }}
                            </div>
                        </div>
                    </div>
                    <div class="w-1/2 flex flex-col overflow-hidden">
                        <div
                            class="shrink-0 flex border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                        >
                            <button
                                class="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors"
                                :class="
                                    rightTab === 'preview'
                                        ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-500'
                                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                                "
                                @click="rightTab = 'preview'"
                            >
                                <i-lucide-smartphone class="text-sm" />
                                {{ $t('task.previewDevice') }}
                            </button>
                            
                            <button
                                class="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors"
                                :class="
                                    rightTab === 'docs'
                                        ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-500'
                                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                                "
                                @click="rightTab = 'docs'"
                            >
                                <i-lucide-book-open class="text-sm" />
                                {{ $t('task.devDoc') }}
                            </button>
                        </div>
                        <div class="flex-1 overflow-hidden">
                            <div v-show="rightTab === 'preview'" class="h-full">
                                <TaskDevicePreviewPanel
                                    ref="devicePreviewPanel"
                                    :selected-device-id="selectedDeviceId"
                                    @insert-locator="onInsertLocator"
                                />
                            </div>
                            
                            <div v-show="rightTab === 'docs'" class="h-full">
                                <TaskDocPanel />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </a-modal>
        <TaskRunDeviceSelectDialog ref="deviceSelectDialog" @confirm="onDeviceSelectConfirm" />
    </div>
</template>
