<script setup lang="ts">
import {nextTick, ref} from 'vue'
import {t} from '../../lang'
import {mapError} from '../../lib/error'
import {useDeviceStore} from '../../store/modules/device'
import {EnumDeviceStatus} from '../../types/Device'
import LogPanel from '../../components/common/LogPanel.vue'
import {runTaskPythonCode} from './TaskRuntime'

const emit = defineEmits<{
    done: []
}>()

const visible = ref(false)
const isRunning = ref(false)
const logPanel = ref<InstanceType<typeof LogPanel> | null>(null)
const taskName = ref('')
let runController: {stop: () => void; send: (data: any) => void} | null = null
let currentTask: {id: number; name: string; code: string; language: string} | null = null

const doStopRun = () => {
    if (runController) {
        runController.stop()
        runController = null
    }
}

const doRun = async (task: {id: number; name: string; code: string; language: string}) => {
    currentTask = task
    taskName.value = task.name
    isRunning.value = true
    visible.value = true
    await nextTick()
    logPanel.value?.clear()

    const deviceStore = useDeviceStore()
    const deviceIds = deviceStore.records.filter((d) => d.status === EnumDeviceStatus.CONNECTED).map((d) => d.id)

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

    try {
        const controller = await runTaskPythonCode(task.code, deviceId, {
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

const doClose = () => {
    if (isRunning.value) {
        doStopRun()
    }
    visible.value = false
    currentTask = null
}

defineExpose({doRun, doClose})
</script>

<template>
    <a-modal v-model:visible="visible" width="min(800px, 90vw)" :footer="false" title-align="start" draggable>
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
                <a-button v-if="isRunning" status="danger" @click="doStopRun">
                    <template #icon><i-lucide-circle-pause /></template>
                    {{ $t('task.stop') }}
                </a-button>
                <a-button @click="doClose">
                    {{ $t('task.runCancel') }}
                </a-button>
            </div>
        </div>
    </a-modal>
</template>
