<script setup lang="ts">
import {computed, onMounted, onUnmounted, ref} from 'vue'
import ListerTop from '../components/common/ListerTop.vue'
import {t} from '../lang'
import {Dialog} from '../lib/dialog'
import {mapError} from '../lib/error'
import {useDeviceStore} from '../store/modules/device'
import {testActionSet, testActionUnset} from '../utils/test'
import TaskEditorDialog from './Task/TaskEditorDialog.vue'
import TaskRunDialog from './Task/TaskRunDialog.vue'
import TaskRunLogDialog from './Task/TaskRunLogDialog.vue'

interface TaskRecord {
    id: number
    created_at: string
    updated_at: string
    name: string
    description: string
    code: string
    language: string
    run_mode?: string
    cron_expression?: string
}

const records = ref<TaskRecord[]>([])
const loading = ref(false)
const searchKeywords = ref('')

const editorDialog = ref<InstanceType<typeof TaskEditorDialog> | null>(null)
const runDialog = ref<InstanceType<typeof TaskRunDialog> | null>(null)
const runLogDialog = ref<InstanceType<typeof TaskRunLogDialog> | null>(null)
const deviceStore = useDeviceStore()

const filterRecords = computed(() => {
    const keywords = searchKeywords.value.toLowerCase()
    if (!keywords) return records.value
    return records.value.filter((r) => r.name.toLowerCase().includes(keywords))
})

const loadData = async () => {
    loading.value = true
    try {
        records.value = await window.$mapi.db.select(`SELECT * FROM task ORDER BY updated_at DESC`)
    } catch (e) {
        Dialog.tipError(mapError(e))
    } finally {
        loading.value = false
    }
}

const doRefresh = async () => {
    Dialog.loadingOn(t('common.refresh'))
    try {
        await loadData()
    } catch (e) {
        Dialog.tipError(mapError(e))
    } finally {
        Dialog.loadingOff()
    }
}

const doAdd = () => {
    editorDialog.value?.show()
}

const doEdit = (record: TaskRecord) => {
    editorDialog.value?.show(record)
}

const doCopy = async (record: TaskRecord) => {
    editorDialog.value?.copy(record)
}

const deleteRecord = async (record: TaskRecord) => {
    try {
        await window.$mapi.db.delete(`DELETE FROM task WHERE id = ?`, [record.id])
        await window.$mapi.db.delete(`DELETE FROM task_run WHERE task_id = ?`, [record.id])
        Dialog.tipSuccess(t('task.deleteSuccess'))
        await loadData()
    } catch (e) {
        Dialog.tipError(mapError(e))
    }
}

const doDelete = async (record: TaskRecord) => {
    Dialog.confirm(t('task.deleteConfirm', {name: record.name})).then(async () => {
        await deleteRecord(record)
    })
}

const doTestDelete = async (record: TaskRecord) => {
    await deleteRecord(record)
}

const doTestEnsureSeed = async () => {
    if (records.value.length > 0) {
        return
    }
    const now = new Date().toISOString()
    try {
        await window.$mapi.db.insert(
            `INSERT INTO task (created_at, updated_at, name, description, code, language) VALUES (?, ?, ?, ?, ?, ?)`,
            [
                now,
                now,
                t('task.seedName'),
                t('task.seedDescription'),
                "import la\ndevice = la.device()\nprint('seed task ok')\nprint('device=' + device.serial())",
                'python',
            ],
        )
        await loadData()
    } catch (e) {
        Dialog.tipError(mapError(e))
    }
}

const doTestRun = async () => {
    await doTestEnsureSeed()
    if (records.value.length > 0) {
        try {
            await doRun(records.value[0])
        } catch (e) {
            Dialog.tipError(mapError(e))
        }
    }
}

const doRun = async (record: TaskRecord) => {
    runLogDialog.value?.doRun(record)
}

const doShowRunRecord = (record: TaskRecord) => {
    runDialog.value?.show(record.id)
}

// ── 测试辅助：创建定时任务 ──
const doTestSetupSchedule = async (cronExpression: string = '*/1 * * * *') => {
    await doTestEnsureSeed()
    if (records.value.length > 0) {
        const record = records.value[0]
        const now = new Date().toISOString()
        await window.$mapi.db.update(`UPDATE task SET run_mode = ?, cron_expression = ?, updated_at = ? WHERE id = ?`, [
            'scheduled',
            cronExpression,
            now,
            record.id,
        ])
        // 重置调度器触发状态
        await window.$mapi.task.resetTaskTrigger(record.id)
        await loadData()
    }
}

// ── 测试辅助：重置为手动模式 ──
const doTestResetToManual = async () => {
    if (records.value.length > 0) {
        const record = records.value[0]
        const now = new Date().toISOString()
        await window.$mapi.db.update(`UPDATE task SET run_mode = ?, cron_expression = ?, updated_at = ? WHERE id = ?`, [
            'manual',
            '',
            now,
            record.id,
        ])
        await loadData()
    }
}

onMounted(async () => {
    await loadData()
    testActionSet('task.refresh', () => doRefresh())
    testActionSet('task.add', () => doAdd())
    testActionSet('task.copy', () => {
        if (records.value.length > 0) doCopy(records.value[0])
    })
    testActionSet('task.edit', () => {
        if (records.value.length > 0) doEdit(records.value[0])
    })
    testActionSet('task.delete', () => {
        if (records.value.length > 0) doTestDelete(records.value[0])
    })
    testActionSet('task.run', () => doTestRun())
    testActionSet('task.setupSchedule', (cronExpression?: string) => doTestSetupSchedule(cronExpression))
    testActionSet('task.resetToManual', () => doTestResetToManual())
})

onUnmounted(() => {
    testActionUnset('task.refresh')
    testActionUnset('task.add')
    testActionUnset('task.copy')
    testActionUnset('task.edit')
    testActionUnset('task.delete')
    testActionUnset('task.run')
    testActionUnset('task.setupSchedule')
    testActionUnset('task.resetToManual')
})
</script>

<template>
    <div class="pb-task-container min-h-[calc(100vh-4rem)] relative select-none">
        <div class="pb-header flex items-center p-6">
            <div class="text-3xl font-bold flex-grow flex items-center gap-2">
                <i-lucide-workflow />
                {{ $t('task.title') }}
            </div>
        </div>
        <div class="px-6">
            <ListerTop v-if="records.length > 0" :loading="loading" @refresh="doRefresh">
                <a-input-search
                    v-model="searchKeywords"
                    :placeholder="$t('task.searchPlaceholder')"
                    class="w-48"
                    allow-clear
                />
                <template #actions>
                    <a-button type="primary" @click="doAdd">
                        <template #icon><i-lucide-plus /></template>
                        {{ $t('task.add') }}
                    </a-button>
                </template>
            </ListerTop>

            <!-- Empty state -->
            <div v-if="records.length === 0" class="py-32 text-center">
                <div class="mb-6">
                    <i-lucide-workflow class="text-6xl text-gray-300" />
                </div>
                <div class="text-gray-400 mb-6">{{ $t('task.noTasks') }}</div>
                <a-button type="primary" @click="doAdd">
                    <template #icon><i-lucide-plus /></template>
                    {{ $t('task.add') }}
                </a-button>
            </div>

            <!-- Filter empty -->
            <div v-else-if="filterRecords.length === 0" class="py-32 text-center text-gray-400">
                <i-lucide-search class="text-4xl mb-4" />
                <div>{{ $t('common.emptyFilterResult') }}</div>
            </div>

            <!-- Script cards -->
            <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                <div
                    v-for="r in filterRecords"
                    :key="r.id"
                    class="bg-white dark:bg-gray-800 border border-solid border-gray-200 dark:border-gray-700 rounded-lg shadow-sm hover:shadow-md transition-shadow flex flex-col"
                >
                    <div class="p-4 flex-grow">
                        <div class="flex items-start gap-2 mb-2">
                            <i-lucide-workflow class="text-xl text-blue-500 mt-0.5" />
                            <div class="flex-1 min-w-0">
                                <div class="font-medium truncate flex items-center gap-2">
                                    {{ r.name }}
                                    <span
                                        v-if="r.run_mode === 'scheduled'"
                                        class="text-xs bg-orange-100 text-orange-600 dark:bg-orange-900 dark:text-orange-300 px-1.5 py-0.5 rounded-full inline-flex items-center gap-1 shrink-0"
                                    >
                                        <i-lucide-clock class="text-xs" />
                                        {{ $t('task.runModeScheduled') }}
                                    </span>
                                </div>
                                <div v-if="r.description" class="text-xs text-gray-400 mt-0.5 truncate">
                                    {{ r.description }}
                                </div>
                            </div>
                        </div>
                        <div class="text-xs text-gray-400 mt-2 flex items-center gap-3">
                            <span>{{ r.language?.toUpperCase() || 'PYTHON' }}</span>
                            <span>{{ new Date(r.updated_at).toLocaleString() }}</span>
                            <span v-if="r.run_mode === 'scheduled' && r.cron_expression" class="text-orange-500">
                                {{ r.cron_expression }}
                            </span>
                        </div>
                    </div>
                    <div
                        class="border-t border-gray-100 dark:border-gray-700 px-3 py-2 flex items-center justify-between"
                    >
                        <div class="flex items-center gap-2">
                            <a-button type="primary" @click="doRun(r)">
                                <template #icon><i-lucide-play /></template>
                                {{ $t('task.run') }}
                            </a-button>
                            <a-button @click="doShowRunRecord(r)">
                                <template #icon><i-lucide-history /></template>
                                {{ $t('task.runRecord') }}
                            </a-button>
                        </div>
                        <a-dropdown trigger="hover">
                            <a-button size="mini" type="text">
                                <template #icon><i-lucide-ellipsis /></template>
                            </a-button>
                            <template #content>
                                <a-doption @click="doEdit(r)">
                                    <template #icon><i-lucide-pencil /></template>
                                    {{ $t('common.edit') }}
                                </a-doption>
                                <a-doption @click="doCopy(r)">
                                    <template #icon><i-lucide-copy /></template>
                                    {{ $t('common.copy') }}
                                </a-doption>
                                <a-doption @click="doDelete(r)">
                                    <template #icon><i-lucide-trash-2 /></template>
                                    {{ $t('common.delete') }}
                                </a-doption>
                            </template>
                        </a-dropdown>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <TaskEditorDialog ref="editorDialog" @update="loadData" />
    <TaskRunDialog ref="runDialog" />
    <TaskRunLogDialog ref="runLogDialog" @done="loadData" />
</template>

<style scoped lang="less">
[data-theme='dark'] {
    .pb-task-container {
        background-color: var(--color-background);

        .pb-header {
            background-color: var(--color-background);
        }
    }
}
</style>
