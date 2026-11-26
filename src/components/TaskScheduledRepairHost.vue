<script setup lang="ts">
import {onMounted, onUnmounted, ref} from 'vue'
import TaskRunLogDialog from '../pages/Task/TaskRunLogDialog.vue'
import {testActionSet, testActionUnset} from '../utils/test'

/** Broadcast payload sent by the main-process scheduler after a scheduled run fails. */
type ScheduledFailure = {
    taskId: number
    runId?: number | string | null
    deviceId?: string
    deviceIds?: string[]
    log?: string
}

const dialog = ref<InstanceType<typeof TaskRunLogDialog> | null>(null)
/** Ignore further failures of the same task while a repair is already running. */
const repairing = new Set<number>()

const loadTask = async (taskId: number) => {
    try {
        return await window.$mapi.db.first('SELECT * FROM task WHERE id = ?', [taskId])
    } catch {
        return null
    }
}

const handleScheduledFailure = async (payload: ScheduledFailure) => {
    if (!payload || !payload.taskId) return
    const taskId = Number(payload.taskId)
    if (repairing.has(taskId)) return
    const task = await loadTask(taskId)
    if (!task) return
    if (task.run_mode !== 'scheduled') return
    if (Number(task.auto_repair ?? 1) === 0) return
    repairing.add(taskId)
    try {
        await dialog.value?.doRunFromScheduledFailure(task, payload)
    } finally {
        repairing.delete(taskId)
    }
}

onMounted(() => {
    window.__page?.onBroadcast?.('TaskScheduledFailed', handleScheduledFailure)
    testActionSet('task.scheduledRepair.open', async (payload: ScheduledFailure) => {
        const task = await loadTask(Number(payload?.taskId))
        if (task) await dialog.value?.doRunFromScheduledFailure(task, payload, {repair: false})
    })
    testActionSet('task.scheduledRepair.enabled', async (taskId: number) => {
        const task = await loadTask(Number(taskId))
        if (!task) return false
        return task.run_mode === 'scheduled' && Number(task.auto_repair ?? 1) !== 0
    })
    testActionSet('task.scheduledRepair.handle', (payload: ScheduledFailure) => handleScheduledFailure(payload))
})

onUnmounted(() => {
    window.__page?.offBroadcast?.('TaskScheduledFailed', handleScheduledFailure)
    testActionUnset('task.scheduledRepair.open')
    testActionUnset('task.scheduledRepair.enabled')
    testActionUnset('task.scheduledRepair.handle')
})
</script>

<template>
    <TaskRunLogDialog ref="dialog" />
</template>
