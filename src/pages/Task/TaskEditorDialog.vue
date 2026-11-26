<script setup lang="ts">
import {computed, nextTick, onMounted, onUnmounted, ref} from 'vue'
import {t} from '../../lang'
import {Dialog} from '../../lib/dialog'
import {mapError} from '../../lib/error'
import {testActionSet, testActionUnset} from '../../utils/test'
import {useDeviceStore} from '../../store/modules/device'
import {EnumDeviceStatus} from '../../types/Device'
import CodeEditor from '../../components/common/CodeEditor.vue'
import LogPanel from '../../components/common/LogPanel.vue'

import TaskDevicePreviewPanel from './TaskDevicePreviewPanel.vue'
import TaskDocPanel from './TaskDocPanel.vue'
import TaskRunDeviceSelectDialog, {type RunDeviceConfig} from './TaskRunDeviceSelectDialog.vue'
import TaskDepsDialog from './TaskDepsDialog.vue'
import TaskFilesPanel from './TaskFilesPanel.vue'
import {useTaskFiles} from './useTaskFiles'
import {runTaskPythonCode, taskMissingDependencies} from './TaskRuntime'
import {autoRepairTask} from './TaskAutoRepair'
import {hasTaskChatModel, firstEnabledModel} from '../../support/agent/agentModel'
import TaskAgentSessionDialog from './TaskAgentSessionDialog.vue'
import {loadAgentSession} from '../../support/agent/agentSession'

const emit = defineEmits<{
    update: []
}>()

const visible = ref(false)
const formData = ref<{
    id: number
    /** Stable task uuid; empty until the task is saved */
    uuid: string
    name: string
    description: string
    code: string
    language: string
    requirement: string
}>({
    id: 0,
    uuid: '',
    name: '',
    description: '',
    requirement: '',
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
// Project id to copy extra files from when saving a freshly copied task
const copyFromId = ref(0)

// ── 项目文件（多文件编辑） ──
const files = useTaskFiles()
const editingEntry = computed(() => files.activePath.value === files.entry.value)
const editorCode = computed({
    get: () => files.activeContent.value,
    set: (value: string) => {
        files.setActiveContent(value)
        if (editingEntry.value) formData.value.code = value
    },
})
const filePanelDisabled = computed(() => formData.value.id <= 0)

// Log area
const showLog = ref(false)
const isRunning = ref(false)
let repairRunning = false
const logPanel = ref<InstanceType<typeof LogPanel> | null>(null)
const sessionViewer = ref<InstanceType<typeof TaskAgentSessionDialog> | null>(null)
const repairSessionId = ref(0)
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
    autoRepair: true,
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
    copyFromId.value = 0
    if (record) {
        formData.value = {
            id: record.id,
            uuid: record.uuid || '',
            name: record.name,
            description: record.description || '',
            requirement: record.requirement || '',
            code: record.code || '',
            language: record.language || 'python',
        }
        // 恢复任务保存的「运行设置」设备
        runDeviceConfig.value = {
            runMode: record.run_mode || 'manual',
            cronExpression: record.cron_expression || '',
            runOnAllDevices: record.run_on_all_devices === 1,
            deviceIds: (record.device_ids || '')
                .split(',')
                .map((id: string) => id.trim())
                .filter((id: string) => id.length > 0),
            autoRepair: Number(record.auto_repair ?? 1) !== 0,
        }
        runDeviceIds.value = runDeviceConfig.value.runOnAllDevices ? [] : [...runDeviceConfig.value.deviceIds]
        selectedDeviceId.value = runDeviceIds.value[0] || deviceOptions.value[0]?.value || ''
    } else {
        formData.value = {
            id: 0,
            uuid: '',
            name: '',
            description: '',
            requirement: '',
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
        runDeviceConfig.value = {
            runMode: 'manual',
            cronExpression: '',
            runOnAllDevices: false,
            deviceIds: [],
            autoRepair: true,
        }
        runDeviceIds.value = []
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
    if (record && record.id > 0) {
        files.reset(Number(record.id), record.code || '', 'main.py')
        refreshProjectFiles(Number(record.id)).then()
    } else {
        files.reset(0, formData.value.code, 'main.py')
    }
}

/** main.py is the source of truth: refresh the editor with the on-disk code. */
const refreshProjectFiles = async (id: number) => {
    try {
        const info = await window.$mapi.project.pathInfo(id)
        if (!info.exists) return
        const entry = info.entry || 'main.py'
        if (formData.value.id !== id) return
        files.reset(id, formData.value.code, entry)
        await files.refresh(id)
        await files.open(id, entry, true)
        formData.value.code = files.entryCode.value
    } catch {
        // fall back to the database snapshot already loaded
    }
}

const copy = (record: any) => {
    copyFromId.value = Number(record.id) || 0
    formData.value = {
        id: 0,
        uuid: '',
        name: record.name ? `${record.name} Copy` : '',
        description: record.description || '',
        requirement: record.requirement || '',
        code: record.code || '',
        language: record.language || 'python',
    }
    // 复制时沿用原任务的运行设置设备
    runDeviceConfig.value = {
        runMode: record.run_mode || 'manual',
        cronExpression: record.cron_expression || '',
        runOnAllDevices: record.run_on_all_devices === 1,
        deviceIds: (record.device_ids || '')
            .split(',')
            .map((id: string) => id.trim())
            .filter((id: string) => id.length > 0),
        autoRepair: Number(record.auto_repair ?? 1) !== 0,
    }
    runDeviceIds.value = runDeviceConfig.value.runOnAllDevices ? [] : [...runDeviceConfig.value.deviceIds]
    if (deviceOptions.value.length > 0 && !selectedDeviceId.value) {
        selectedDeviceId.value = deviceOptions.value[0].value
    }
    if (runDeviceIds.value.length === 0 && selectedDeviceId.value) {
        runDeviceIds.value = [selectedDeviceId.value]
        runDeviceConfig.value.deviceIds = [selectedDeviceId.value]
    }
    visible.value = true
    files.reset(0, formData.value.code, 'main.py')
}


const devicePreviewPanel = ref<InstanceType<typeof TaskDevicePreviewPanel> | null>(null)
const isPreviewLoading = computed(() => {
    const panel = devicePreviewPanel.value as any
    return panel?.loading?.value === true
})

// Device settings dialog ref
const deviceSelectDialog = ref<InstanceType<typeof TaskRunDeviceSelectDialog> | null>(null)
const depsDialog = ref<InstanceType<typeof TaskDepsDialog> | null>(null)

const doSave = async () => {
    if (!formData.value.name.trim()) {
        Dialog.tipError(t('task.nameRequired'))
        return
    }
    try {
        const entryCode = files.entryCode.value
        // 已有任务先写回其他文件的修改，再更新任务元信息
        if (formData.value.id > 0) {
            await files.saveAll(formData.value.id)
        }
        const row = await window.$mapi.project.save({
            id: formData.value.id || 0,
            name: formData.value.name.trim(),
            description: formData.value.description.trim(),
            requirement: formData.value.requirement || '',
            code: entryCode,
            language: formData.value.language,
            runMode: runDeviceConfig.value.runMode,
            cronExpression: runDeviceConfig.value.cronExpression,
            deviceIds: [...runDeviceConfig.value.deviceIds],
            runOnAllDevices: runDeviceConfig.value.runOnAllDevices,
            autoRepair: runDeviceConfig.value.autoRepair,
            copyFromId: formData.value.id ? undefined : copyFromId.value || undefined,
        })
        if (row?.id) {
            formData.value.id = Number(row.id)
            formData.value.uuid = row.uuid || formData.value.uuid
            copyFromId.value = 0
            const active = files.activePath.value || files.entry.value
            files.markSaved(entryCode)
            files.reset(Number(row.id), entryCode, files.entry.value)
            await files.refresh(Number(row.id))
            await files.open(Number(row.id), active, true)
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

// 立即保存完整「运行设置」(运行模式 / cron / 目标设备)
const saveRunConfig = async () => {
    if (formData.value.id > 0) {
        try {
            await files.saveAll(formData.value.id)
            await window.$mapi.project.save({
                id: formData.value.id,
                name: formData.value.name.trim() || t('task.debugRun'),
                description: formData.value.description.trim(),
                requirement: formData.value.requirement || '',
                code: files.entryCode.value,
                language: formData.value.language,
                runMode: runDeviceConfig.value.runMode,
                cronExpression: runDeviceConfig.value.cronExpression,
                deviceIds: [...runDeviceConfig.value.deviceIds],
                runOnAllDevices: runDeviceConfig.value.runOnAllDevices,
                autoRepair: runDeviceConfig.value.autoRepair,
            })
        } catch (e) {
            // Non-critical, log silently
            console.error('Failed to save run config:', e)
        }
    }
}

const onDeviceSelectConfirm = (config: RunDeviceConfig) => {
    runDeviceConfig.value = config
    runDeviceIds.value = config.runOnAllDevices ? [] : [...config.deviceIds]
    selectedDeviceId.value = runDeviceIds.value[0] || selectedDeviceId.value
    // 确认后立即持久化到任务（新建任务则随保存按钮写入）
    if (formData.value.id > 0) {
        saveRunConfig()
    }
}

const onSelectedDeviceChange = (deviceId: string) => {
    runDeviceIds.value = deviceId ? [deviceId] : []
}

const doClearLog = () => {
    logPanel.value?.clear()
}

const doShowRepairSession = async () => {
    if (!repairSessionId.value) return
    const session = await loadAgentSession(repairSessionId.value)
    if (!session?.opencode_session_id) return
    const {messages} = await window.$mapi.opencodeAgent.sessionContext({
        opencodeSessionId: session.opencode_session_id,
    })
    sessionViewer.value?.show({messages})
}

const doStopRun = () => {
    if (runController) {
        runController.stop()
        runController = null
    }
}

const runTaskInternal = async () => {
    // Always show the log window when clicking debug run
    showLog.value = true
    isRunning.value = false
    await nextTick()
    logPanel.value?.clear()

    if (runDeviceIds.value.length === 0) {
        const msg = t('hint.selectDeviceFirst')
        logPanel.value?.printSystem(msg)
        Dialog.tipError(msg)
        return
    }
    if (!formData.value.name.trim()) {
        // Auto-generate a temporary name for debug run
        formData.value.name = t('task.debugRun') + '_' + Date.now()
    }

    isRunning.value = true
    try {
        const entryCode = files.entryCode.value
        // Save first: writes linkandroid.json + 入口文件，并写回其他文件的修改
        if (formData.value.id > 0) {
            await files.saveAll(formData.value.id)
        }
        const saved = await window.$mapi.project.save({
            id: formData.value.id || 0,
            name: formData.value.name.trim(),
            description: formData.value.description.trim(),
            requirement: formData.value.requirement || '',
            code: entryCode,
            language: formData.value.language,
            runMode: runDeviceConfig.value.runMode,
            cronExpression: runDeviceConfig.value.cronExpression,
            deviceIds: [...runDeviceConfig.value.deviceIds],
            runOnAllDevices: runDeviceConfig.value.runOnAllDevices,
            autoRepair: runDeviceConfig.value.autoRepair,
            copyFromId: formData.value.id ? undefined : copyFromId.value || undefined,
        })
        if (saved?.id) {
            formData.value.id = Number(saved.id)
            formData.value.uuid = saved.uuid || formData.value.uuid
            copyFromId.value = 0
            files.markSaved(entryCode)
            await files.refresh(Number(saved.id))
        }

        emit('update')

        const deviceId = runDeviceIds.value[0]
        const controller = await runTaskPythonCode(entryCode, deviceId, {
            projectId: formData.value.id,
            preparing: () => {
                logPanel.value?.printSystem(t('task.runPreparing'))
            },
            started: () => {
                logPanel.value?.printSystem(t('task.runStarted'))
            },
            stdout: (data: string) => {
                logPanel.value?.printLogChunk(data)
            },
            stderr: (data: string) => {
                logPanel.value?.printErrorChunk(data)
            },
            success: () => {
                logPanel.value?.printSystem(t('task.runSuccess'))
                isRunning.value = false
                runController = null
                repairRunning = false
            },
            error: async (msg: string) => {
                logPanel.value?.printError(t('task.runFailed') + ': ' + msg)
                isRunning.value = false
                runController = null
                if (repairRunning) {
                    repairRunning = false
                    emit('update')
                    return
                }
                // Missing packages are not a code bug: ask the user to install, do not call the AI.
                if ((await taskMissingDependencies(formData.value.id)).length > 0) {
                    emit('update')
                    return
                }
                const failureLog = logPanel.value?.getPlainText() || msg
                await tryAutoRepair(failureLog)
                emit('update')
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
        logPanel.value?.printError(mapError(e))
        Dialog.tipError(mapError(e))
    }
}

const doRun = async () => {
    repairRunning = false
    repairSessionId.value = 0
    await runTaskInternal()
}

/** After a failed run, ask OpenCode to repair the code and rerun it once. */
const tryAutoRepair = async (failureLog: string) => {
    if (!runDeviceConfig.value.autoRepair) {
        logPanel.value?.printSystem(t('task.repairDisabled'))
        return
    }
    if (!(await hasTaskChatModel())) return
    const deviceId = runDeviceIds.value[0] || selectedDeviceId.value
    const requirement = (
        formData.value.requirement ||
        chatPanel.value?.getLastRequirement() ||
        formData.value.name ||
        ''
    ).trim()
    logPanel.value?.printSystem(t('task.repairStarted'))
    isRunning.value = true
    let result
    try {
        result = await autoRepairTask({
            taskUuid: formData.value.uuid,
            taskName: formData.value.name,
            requirement,
            code: formData.value.code,
            deviceId,
            failureLog,
            onProgress: (message) => logPanel.value?.printSystem(message),
        })
    } catch (e: any) {
        isRunning.value = false
        logPanel.value?.printError(t('task.repairFailed', {error: e?.message || e}))
        return
    }
    repairSessionId.value = result.sessionId || 0
    if (!result.ok || !result.code) {
        isRunning.value = false
        logPanel.value?.printError(t('task.repairFailed', {error: result.message}))
        return
    }
    formData.value.code = result.code
    files.setEntryCode(result.code)
    if (!editingEntry.value) {
        files.activePath.value = files.entry.value
        files.activeContent.value = result.code
    }
    formData.value.requirement = requirement
    logPanel.value?.printSystem(t('task.repairApplied'))
    isRunning.value = false
    repairRunning = true
    await runTaskInternal()
}

const fillForm = (
    data: Partial<{name: string; description: string; code: string; language: string; deviceId: string}>,
) => {
    formData.value = {
        ...formData.value,
        ...data,
    }
    if (data.code !== undefined) {
        files.setEntryCode(data.code)
        if (editingEntry.value) files.activeContent.value = data.code
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
    return files.entryCode.value
}

const testGetRunConfig = () => {
    return {
        runMode: runDeviceConfig.value.runMode,
        cronExpression: runDeviceConfig.value.cronExpression,
        runOnAllDevices: runDeviceConfig.value.runOnAllDevices,
        deviceIds: [...runDeviceConfig.value.deviceIds],
        autoRepair: runDeviceConfig.value.autoRepair,
    }
}



const onInsertLocator = (code: string) => {
    const next = `${files.activeContent.value.trimEnd()}\n\n${code}\n`
    files.setActiveContent(next)
    if (editingEntry.value) formData.value.code = next
}

const mapFileError = (e: any) => {
    const message = String(e?.message || e || '')
    if (message.includes('FileExists')) return t('task.file.exists')
    if (message.includes('EntryFileProtected') || message.includes('FileProtected')) return t('task.file.protected')
    if (message.includes('TaskNotSaved')) return t('task.file.saveFirst')
    if (message.includes('PathOutOfProject')) return t('task.file.invalidPath')
    if (message.includes('FileTooLarge')) return t('task.file.tooLarge')
    return mapError(e)
}

const doSelectFile = async (path: string) => {
    if (formData.value.id <= 0) return
    try {
        await files.open(formData.value.id, path)
    } catch (e) {
        Dialog.tipError(mapFileError(e))
    }
}

const ensureProjectSaved = async () => {
    if (formData.value.id > 0) return true
    if (!formData.value.name.trim()) {
        Dialog.tipError(t('task.nameRequired'))
        return false
    }
    await doSave()
    return formData.value.id > 0
}

const doCreateFile = async (path: string) => {
    try {
        if (!(await ensureProjectSaved())) return
        await files.createFile(formData.value.id, path)
    } catch (e) {
        Dialog.tipError(mapFileError(e))
    }
}

const doRenameFile = async (fromPath: string, toPath: string) => {
    try {
        await files.renameFile(formData.value.id, fromPath, toPath)
    } catch (e) {
        Dialog.tipError(mapFileError(e))
    }
}

const doRemoveFile = (path: string) => {
    Dialog.confirm(t('task.file.deleteConfirm', {path})).then(async () => {
        try {
            await files.removeFile(formData.value.id, path)
        } catch (e) {
            Dialog.tipError(mapFileError(e))
        }
    })
}

const close = (force = false) => {
    if (!force && files.hasDirty.value) {
        Dialog.confirm(t('task.file.unsavedCloseConfirm')).then(() => {
            visible.value = false
        })
        return
    }
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
    testActionSet('task.editor.getActiveCode', () => files.activeContent.value)
    testActionSet('task.editor.getRunConfig', () => testGetRunConfig())
    testActionSet('task.editor.files', () => ({
        entry: files.entry.value,
        active: files.activePath.value,
        files: files.visibleFiles.value.map((file) => file.path),
        dirty: files.dirtyPaths.value,
    }))
    testActionSet('task.editor.fileOpen', async (path: string) => doSelectFile(path))
    testActionSet('task.editor.fileCreate', async (path: string) => doCreateFile(path))
    testActionSet('task.editor.fileRename', async (arg: {from: string; to: string}) => doRenameFile(arg.from, arg.to))
    testActionSet('task.editor.fileDelete', async (path: string) => {
        if (formData.value.id > 0) await files.removeFile(formData.value.id, path)
    })
    testActionSet('task.editor.fileWrite', async (arg: {path: string; content: string}) => {
        await doSelectFile(arg.path)
        files.setActiveContent(arg.content)
        if (arg.path === files.entry.value) formData.value.code = arg.content
    })
    testActionSet('task.editor.close', () => close(true))
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
    testActionUnset('task.editor.getActiveCode')
    testActionUnset('task.editor.getRunConfig')
    testActionUnset('task.editor.files')
    testActionUnset('task.editor.fileOpen')
    testActionUnset('task.editor.fileCreate')
    testActionUnset('task.editor.fileRename')
    testActionUnset('task.editor.fileDelete')
    testActionUnset('task.editor.fileWrite')
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
            :esc-to-close="false"
            :style="{height: 'calc(100vh - 96px)'}"
        >
            <template #title>
                <div class="font-bold">
                    {{ isEditMode ? $t('task.edit') : $t('task.add') }}
                </div>
            </template>
            <div class="-mx-5 -my-6 flex flex-col" style="height: calc(100vh - 208px)">
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
                    <!-- Task pip dependencies -->
                    <a-tooltip :content="$t('task.depsDesc')">
                        <a-button v-if="formData.id" @click="depsDialog?.show({id: formData.id})">
                            <template #icon><i-lucide-package /></template>
                            {{ $t('task.depsTitle') }}
                        </a-button>
                    </a-tooltip>
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
                <div class="flex flex-1 min-h-0 overflow-hidden">
                    <div
                        class="w-1/2 flex flex-col min-h-0 overflow-hidden border-r border-gray-200 dark:border-gray-700"
                    >
                        <div class="flex-1 min-h-0 flex overflow-hidden">
                            <div class="w-52 shrink-0 border-r border-gray-200 dark:border-gray-700 overflow-hidden">
                                <TaskFilesPanel
                                    :files="files.visibleFiles.value"
                                    :active-path="files.activePath.value"
                                    :entry="files.entry.value"
                                    :dirty-paths="files.dirtyPaths.value"
                                    :disabled="filePanelDisabled"
                                    @select="doSelectFile"
                                    @create="doCreateFile"
                                    @rename="doRenameFile"
                                    @remove="doRemoveFile"
                                />
                            </div>
                            <div class="flex-1 min-w-0 min-h-0 overflow-hidden p-2 flex flex-col">
                                <CodeEditor
                                    v-model="editorCode"
                                    language="python"
                                    height="100%"
                                    class="flex-1 min-h-0"
                                />
                            </div>
                        </div>
                        <div
                            v-if="showLog"
                            class="shrink-0 border-t border-gray-200 dark:border-gray-700 flex flex-col"
                            style="height: 180px"
                        >
                            <LogPanel
                                ref="logPanel"
                                :title="$t('task.runLog')"
                                :empty-text="$t('task.noLog')"
                                :running="isRunning"
                                text-size="xs"
                            >
                                <template #actions>
                                    <div class="flex items-center gap-1">
                                        <a-button v-if="isRunning" size="mini" status="danger" @click="doStopRun">
                                            <template #icon><i-lucide-circle-pause /></template>
                                            {{ $t('task.stop') }}
                                        </a-button>
                                        <a-button v-if="repairSessionId" size="mini" @click="doShowRepairSession">
                                            <template #icon><i-lucide-bot /></template>
                                            查看 AI 修复会话
                                        </a-button>
                                        <a-button size="mini" @click="doClearLog">
                                            <template #icon><i-lucide-trash-2 /></template>
                                            {{ $t('task.clearLog') }}
                                        </a-button>
                                        <a-button size="mini" @click="showLog = false">
                                            <template #icon><i-lucide-x /></template>
                                        </a-button>
                                    </div>
                                </template>
                            </LogPanel>
                        </div>
                    </div>
                    <div class="w-1/2 flex flex-col min-h-0 overflow-hidden">
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
                        <div class="flex-1 min-h-0 overflow-hidden">
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
        <TaskDepsDialog ref="depsDialog" />
        <TaskAgentSessionDialog ref="sessionViewer" />
    </div>
</template>
