<script setup lang="ts">
import {nextTick, ref} from 'vue'
import {t} from '../../lang'
import {mapError} from '../../lib/error'
import {useDeviceStore} from '../../store/modules/device'
import {EnumDeviceStatus} from '../../types/Device'
import {runTaskPythonCode} from './TaskRuntime'

const emit = defineEmits<{
    done: []
}>()

const visible = ref(false)
const logContent = ref('')
const isRunning = ref(false)
const taskName = ref('')
let runController: {stop: () => void; send: (data: any) => void} | null = null
let currentTask: {id: number; name: string; code: string; language: string} | null = null

const appendLog = (text: string) => {
    logContent.value += text
    nextTick(() => {
        const el = document.querySelector('.task-run-log-content')
        if (el) el.scrollTop = el.scrollHeight
    })
}

const doStopRun = () => {
    if (runController) {
        runController.stop()
        runController = null
    }
}

const doRun = async (task: {id: number; name: string; code: string; language: string}) => {
    currentTask = task
    taskName.value = task.name
    logContent.value = ''
    isRunning.value = true
    visible.value = true

    const deviceStore = useDeviceStore()
    const deviceIds = deviceStore.records.filter((d) => d.status === EnumDeviceStatus.CONNECTED).map((d) => d.id)

    if (deviceIds.length === 0) {
        appendLog(t('hint.selectDeviceFirst'))
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
        appendLog('--- ' + mapError(e) + ' ---')
        isRunning.value = false
        return
    }

    try {
        const controller = await runTaskPythonCode(task.code, deviceId, {
            stdout: (data: string) => {
                appendLog(data)
            },
            stderr: (data: string) => {
                appendLog(data)
            },
            success: async () => {
                appendLog('\n--- ' + t('task.runSuccess') + ' ---\n')
                isRunning.value = false
                runController = null
                if (runId) {
                    await window.$mapi.db.update(
                        `UPDATE task_run SET updated_at = ?, status = ?, log = ?, finished_at = ? WHERE id = ?`,
                        [new Date().toISOString(), 'success', logContent.value, new Date().toISOString(), runId],
                    )
                }
                emit('done')
            },
            error: async (msg: string) => {
                const errText = '\n--- ' + t('task.statusFailed') + ': ' + msg + ' ---\n'
                appendLog(errText)
                isRunning.value = false
                runController = null
                if (runId) {
                    await window.$mapi.db.update(
                        `UPDATE task_run SET updated_at = ?, status = ?, log = ?, finished_at = ? WHERE id = ?`,
                        [new Date().toISOString(), 'failed', logContent.value, new Date().toISOString(), runId],
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
        appendLog('\n--- ' + mapError(e) + ' ---\n')
        if (runId) {
            await window.$mapi.db
                .update(`UPDATE task_run SET updated_at = ?, status = ?, log = ?, finished_at = ? WHERE id = ?`, [
                    new Date().toISOString(),
                    'failed',
                    logContent.value,
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
                <pre
                    class="task-run-log-content flex-1 overflow-auto p-4 text-sm font-mono leading-relaxed m-0 bg-gray-900 text-green-400 rounded-lg"
                    style="white-space: pre-wrap; word-break: break-all; min-height: 200px">{{ logContent }}<span
                        v-if="isRunning"
                        class="inline-block w-2 h-4 bg-green-400 animate-pulse ml-0.5 align-bottom"
                    /></pre>
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
