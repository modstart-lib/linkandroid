<script setup lang="ts">
import {nextTick, ref} from 'vue'
import {t} from '../../lang'
import {mapError} from '../../lib/error'
import {useDeviceStore} from '../../store/modules/device'
import {EnumDeviceStatus} from '../../types/Device'
import LogPanel from '../../components/common/LogPanel.vue'
import {runTaskPythonCode} from './TaskRuntime'
import {autoRepairTask} from './TaskAutoRepair'
import {hasTaskChatModel} from '../../support/agent/agentModel'
import TaskAgentSessionDialog from './TaskAgentSessionDialog.vue'
import {loadAgentSession} from '../../support/agent/agentSession'

const emit = defineEmits<{
    done: []
}>()

const visible = ref(false)
const isRunning = ref(false)
const logPanel = ref<InstanceType<typeof LogPanel> | null>(null)
const taskName = ref('')
const sessionViewer = ref<InstanceType<typeof TaskAgentSessionDialog> | null>(null)
const repairSessionId = ref(0)
let runController: {stop: () => void; send: (data: any) => void} | null = null
let currentTask: {
    id: number
    uuid?: string
    name: string
    code: string
    language: string
    requirement?: string
    description?: string
    device_ids?: string
    run_on_all_devices?: number
    auto_repair?: number
} | null = null
let repairRunning = false
/** Run record id of the attempt being repaired (manual run or scheduled run). */
let currentRunId: number | string | null = null

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

/** 优先使用任务保存的「运行设置」设备; 未配置则自动取所有已连接设备 */
const resolveTaskDeviceIds = (task: {device_ids?: string; run_on_all_devices?: number}): string[] => {
    const connectedDeviceIds = useDeviceStore()
        .records.filter((d) => d.status === EnumDeviceStatus.CONNECTED)
        .map((d) => d.id)
    if (task.run_on_all_devices === 1) {
        return connectedDeviceIds
    }
    const bound = (task.device_ids || '')
        .split(',')
        .map((id) => id.trim())
        .filter((id) => id.length > 0)
    return bound.length > 0 ? bound : connectedDeviceIds
}

const runTaskInternal = async (task: {
    id: number
    uuid?: string
    name: string
    code: string
    language: string
    requirement?: string
    description?: string
    device_ids?: string
    run_on_all_devices?: number
    auto_repair?: number
}) => {
    currentTask = task
    taskName.value = task.name
    isRunning.value = true
    visible.value = true
    await nextTick()
    logPanel.value?.clear()

    const deviceIds = resolveTaskDeviceIds(task)

    if (deviceIds.length === 0) {
        logPanel.value?.printSystem(t('hint.selectDeviceFirst'))
        isRunning.value = false
        return
    }

    const deviceId = deviceIds[0]

    // Create run record
    const now = new Date().toISOString()
    let runId: number | string | null = null
    try {
        runId = await window.$mapi.db.insert(
            `INSERT INTO task_run (created_at, updated_at, task_id, device_id, status, log, started_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [now, now, task.id, deviceIds.join(','), 'running', '', now],
        )
    } catch (e) {
        logPanel.value?.printError(mapError(e))
        isRunning.value = false
        return
    }
    currentRunId = runId

    try {
        const controller = await runTaskPythonCode(task.code, deviceId, {
            projectId: task.id,
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
            success: async () => {
                logPanel.value?.printSystem(t('task.runSuccess'))
                isRunning.value = false
                runController = null
                repairRunning = false
                if (runId) {
                    const plainLog = logPanel.value?.getPlainText() || ''
                    await window.$mapi.db.update(
                        `UPDATE task_run SET updated_at = ?, status = ?, log = ?, finished_at = ? WHERE id = ?`,
                        [new Date().toISOString(), 'success', plainLog, new Date().toISOString(), runId],
                    )
                }
                emit('done')
            },
            error: async (msg: string) => {
                logPanel.value?.printError(t('task.runFailed') + ': ' + msg)
                isRunning.value = false
                runController = null
                if (runId) {
                    const plainLog = logPanel.value?.getPlainText() || ''
                    await window.$mapi.db.update(
                        `UPDATE task_run SET updated_at = ?, status = ?, log = ?, finished_at = ? WHERE id = ?`,
                        [new Date().toISOString(), 'failed', plainLog, new Date().toISOString(), runId],
                    )
                }
                emit('done')
                if (repairRunning) {
                    repairRunning = false
                    return
                }
                const failureLog = logPanel.value?.getPlainText() || msg
                await tryAutoRepair(task, deviceId, failureLog)
            },
            deviceIds,
            env: {
                LINKANDROID_TASK_ID: `${task.id}`,
                LINKANDROID_TASK_NAME: task.name,
            },
        })
        runController = controller
    } catch (e) {
        isRunning.value = false
        logPanel.value?.printError(mapError(e))
        if (runId) {
            const plainLog = logPanel.value?.getPlainText() || ''
            await window.$mapi.db
                .update(`UPDATE task_run SET updated_at = ?, status = ?, log = ?, finished_at = ? WHERE id = ?`, [
                    new Date().toISOString(),
                    'failed',
                    plainLog,
                    new Date().toISOString(),
                    runId,
                ])
                .catch(() => {})
        }
        emit('done')
    }
}

const doRun = async (task: {
    id: number
    name: string
    code: string
    language: string
    requirement?: string
    description?: string
    device_ids?: string
    run_on_all_devices?: number
    auto_repair?: number
}) => {
    repairRunning = false
    repairSessionId.value = 0
    currentRunId = null
    await runTaskInternal(task)
}

/**
 * 定时任务失败后由主进程广播触发：先展示失败日志，再自动让 AI 修复并重跑一次。
 * option.repair=false 仅供测试验证弹窗展示，不发起真实修复。
 */
const doRunFromScheduledFailure = async (
    task: {
        id: number
        uuid?: string
        name: string
        code: string
        language: string
        requirement?: string
        description?: string
        device_ids?: string
        run_on_all_devices?: number
        auto_repair?: number
    },
    failure: {runId?: number | string | null; deviceId?: string; deviceIds?: string[]; log?: string},
    option?: {repair?: boolean},
) => {
    repairRunning = false
    repairSessionId.value = 0
    currentRunId = failure.runId ?? null
    currentTask = task
    taskName.value = task.name
    isRunning.value = false
    visible.value = true
    await nextTick()
    logPanel.value?.clear()
    logPanel.value?.printSystem(t('task.scheduledFailedDetected'))
    if (failure.log) logPanel.value?.printError(failure.log)
    if (option?.repair === false) return
    const deviceId = failure.deviceId || resolveTaskDeviceIds(task)[0] || ''
    if (!deviceId) {
        logPanel.value?.printSystem(t('hint.selectDeviceFirst'))
        return
    }
    await tryAutoRepair(task, deviceId, failure.log || '')
}

/** After a failed run, ask OpenCode to repair the code and rerun it once. */
const tryAutoRepair = async (
    task: {
        id: number
        uuid?: string
        name: string
        code: string
        requirement?: string
        description?: string
        auto_repair?: number
    },
    deviceId: string,
    failureLog: string,
) => {
    if (Number(task.auto_repair ?? 1) === 0) {
        logPanel.value?.printSystem(t('task.repairDisabled'))
        return
    }
    if (!(await hasTaskChatModel())) return
    const requirement = (task.requirement || task.description || task.name || '').trim()
    logPanel.value?.printSystem(t('task.repairStarted'))
    isRunning.value = true
    let result
    try {
        result = await autoRepairTask({
            taskUuid: task.uuid || '',
            refId: currentRunId || undefined,
            taskName: task.name,
            requirement,
            code: task.code,
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
    const nextTask = {...task, code: result.code, requirement}
    currentTask = nextTask as any
    logPanel.value?.printSystem(t('task.repairApplied'))
    await window.$mapi.project
        .save({
            id: task.id,
            name: task.name || t('task.debugRun'),
            description: task.description || '',
            requirement,
            code: result.code,
        })
        .catch(() => {})
    isRunning.value = false
    repairRunning = true
    await runTaskInternal(nextTask)
}

const doClose = () => {
    if (isRunning.value) {
        doStopRun()
    }
    visible.value = false
    currentTask = null
}

defineExpose({doRun, doRunFromScheduledFailure, doClose})
</script>

<template>
    <a-modal v-model:visible="visible" width="min(800px, 95vw)" :footer="false" title-align="start" draggable>
        <template #title>
            <div class="font-bold flex items-center gap-2">
                <i-lucide-play class="text-blue-500" />
                {{ $t('task.runLog') }}
                <span class="text-sm font-normal text-gray-400 ml-1">- {{ taskName }}</span>
            </div>
        </template>
        <div class="-mx-5 -my-6 flex flex-col" style="min-height: 300px; max-height: calc(80vh - 100px)">
            <div class="flex-1 flex flex-col p-5 overflow-hidden">
                <LogPanel
                    ref="logPanel"
                    :title="$t('task.runLog')"
                    :empty-text="$t('task.noLog')"
                    :running="isRunning"
                    text-size="sm"
                    class="rounded-lg overflow-hidden"
                />
            </div>
            <div class="flex items-center justify-end gap-2 px-5 pb-4 shrink-0">
                <a-button v-if="repairSessionId" @click="doShowRepairSession">
                    <template #icon><i-lucide-bot /></template>
                    查看 AI 修复会话
                </a-button>
                <a-button v-if="isRunning" status="danger" @click="doStopRun">
                    <template #icon><i-lucide-circle-pause /></template>
                    {{ $t('task.stop') }}
                </a-button>
                <a-button @click="doClose">
                    {{ $t('task.runCancel') }}
                </a-button>
            </div>
        </div>
        <TaskAgentSessionDialog ref="sessionViewer" />
    </a-modal>
</template>
