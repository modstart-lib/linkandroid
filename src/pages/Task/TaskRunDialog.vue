<script setup lang="ts">
import {onMounted, onUnmounted, ref, watch} from 'vue'
import ListerTop from '../../components/common/ListerTop.vue'
import {testActionSet, testActionUnset} from '../../utils/test'

const visible = ref(false)
const taskId = ref<number | null>(null)
const records = ref<any[]>([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(10)
const detailVisible = ref(false)
const detailRecord = ref<any>(null)
const loading = ref(false)
const filterStatus = ref<string>('')
const filterStartDate = ref<any>(null)
const filterEndDate = ref<any>(null)

const show = (id: number) => {
    taskId.value = id
    currentPage.value = 1
    filterStatus.value = ''
    filterStartDate.value = null
    filterEndDate.value = null
    visible.value = true
    loadData()
}

const statusMap: Record<string, string> = {
    pending: 'task.statusPending',
    running: 'task.statusRunning',
    success: 'task.statusSuccess',
    failed: 'task.statusFailed',
}

const statusColor: Record<string, string> = {
    pending: 'gray',
    running: 'blue',
    success: 'green',
    failed: 'red',
}

const buildWhereClause = (): {where: string; params: any[]} => {
    const conditions: string[] = ['task_id = ?']
    const params: any[] = [taskId.value]
    if (filterStatus.value) {
        conditions.push('status = ?')
        params.push(filterStatus.value)
    }
    if (filterStartDate.value) {
        conditions.push('created_at >= ?')
        params.push(filterStartDate.value.toISOString())
    }
    if (filterEndDate.value) {
        conditions.push('created_at <= ?')
        params.push(filterEndDate.value.toISOString())
    }
    return {where: conditions.join(' AND '), params}
}

const loadData = async () => {
    if (!taskId.value) return
    loading.value = true
    try {
        const {where, params} = buildWhereClause()
        const offset = (currentPage.value - 1) * pageSize.value
        const rows = await window.$mapi.db.select(
            `SELECT * FROM task_run WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
            [...params, pageSize.value, offset],
        )
        records.value = rows
        const countResult = await window.$mapi.db.first(`SELECT COUNT(*) as cnt FROM task_run WHERE ${where}`, params)
        total.value = countResult?.cnt || 0
    } catch (e) {
        console.error(e)
    } finally {
        loading.value = false
    }
}

const onFilterChange = () => {
    currentPage.value = 1
    loadData()
}

const doPageChange = (page: number) => {
    currentPage.value = page
    loadData()
}

const showDetail = (record: any) => {
    detailRecord.value = record
    detailVisible.value = true
}

const close = () => {
    visible.value = false
}

onMounted(() => {
    testActionSet('task.runRecord', async () => {
        const rows = await window.$mapi.db.select(`SELECT id FROM task ORDER BY updated_at DESC LIMIT 1`)
        if (rows.length > 0) show(rows[0].id)
    })
    testActionSet('task.runRecord.close', () => close())
})

onUnmounted(() => {
    testActionUnset('task.runRecord')
    testActionUnset('task.runRecord.close')
})

defineExpose({show, close})

watch(visible, (val) => {
    if (!val) {
        detailVisible.value = false
        detailRecord.value = null
    }
})
</script>

<template>
    <!-- Run history list modal -->
    <a-modal v-model:visible="visible" width="min(1100px, 95vw)" :footer="false" title-align="start">
        <template #title>
            <div class="font-bold">
                {{ $t('task.runHistory') }}
            </div>
        </template>
        <div class="-mx-5 -my-6">
            <div class="overflow-y-auto p-5" style="height: var(--modal-height-lg)">
                <ListerTop :loading="loading" @refresh="loadData">
                    <a-select
                        v-model="filterStatus"
                        :placeholder="$t('common.allStatus')"
                        allow-clear
                        style="width: 140px"
                        @change="onFilterChange"
                    >
                        <a-option value="">{{ $t('common.allStatus') }}</a-option>
                        <a-option value="pending">{{ $t('task.statusPending') }}</a-option>
                        <a-option value="running">{{ $t('task.statusRunning') }}</a-option>
                        <a-option value="success">{{ $t('task.statusSuccess') }}</a-option>
                        <a-option value="failed">{{ $t('task.statusFailed') }}</a-option>
                    </a-select>
                    <a-date-picker
                        v-model="filterStartDate"
                        :placeholder="$t('common.startDate')"
                        show-time
                        allow-clear
                        style="width: 220px"
                        @change="onFilterChange"
                    />
                    <span class="text-gray-400">~</span>
                    <a-date-picker
                        v-model="filterEndDate"
                        :placeholder="$t('common.endDate')"
                        show-time
                        allow-clear
                        style="width: 220px"
                        @change="onFilterChange"
                    />
                </ListerTop>
                <div v-if="records.length === 0" class="py-16 text-center text-gray-400">
                    {{ $t('task.noRecords') }}
                </div>
                <a-table
                    v-else
                    :data="records"
                    :pagination="{
                        total,
                        current: currentPage,
                        pageSize,
                        showTotal: true,
                        sizeCanChange: false,
                    }"
                    @page-change="doPageChange"
                    row-key="id"
                    :loading="loading"
                >
                    <template #columns>
                        <a-table-column title="#" :width="50">
                            <template #cell="{rowIndex}">{{ rowIndex + 1 + (currentPage - 1) * pageSize }}</template>
                        </a-table-column>
                        <a-table-column :title="$t('task.status')" :width="100">
                            <template #cell="{record}">
                                <a-tag :color="statusColor[record.status] || 'gray'">
                                    {{ $t(statusMap[record.status] || 'common.unknown') }}
                                </a-tag>
                            </template>
                        </a-table-column>
                        <a-table-column :title="$t('task.device')" :width="160">
                            <template #cell="{record}">
                                {{ record.device_id || '-' }}
                            </template>
                        </a-table-column>
                        <a-table-column :title="$t('task.startedAt')" :width="180">
                            <template #cell="{record}">
                                {{ record.started_at ? new Date(record.started_at).toLocaleString() : '-' }}
                            </template>
                        </a-table-column>
                        <a-table-column :title="$t('task.finishedAt')" :width="180">
                            <template #cell="{record}">
                                {{ record.finished_at ? new Date(record.finished_at).toLocaleString() : '-' }}
                            </template>
                        </a-table-column>
                        <a-table-column :title="$t('common.more')" :width="80">
                            <template #cell="{record}">
                                <a-button @click="showDetail(record)">{{ $t('common.detail') }}</a-button>
                            </template>
                        </a-table-column>
                    </template>
                </a-table>
            </div>
        </div>
    </a-modal>

    <!-- Detail log modal -->
    <a-modal v-model:visible="detailVisible" width="min(800px, 90vw)" :footer="false" title-align="start">
        <template #title>
            <div class="font-bold">
                {{ $t('task.runDetail') }}
            </div>
        </template>
        <div class="-mx-5 -my-6 flex flex-col" style="min-height: 300px; max-height: calc(80vh - 100px)">
            <div class="flex-1 flex flex-col p-5 overflow-hidden">
                <div v-if="detailRecord" class="flex flex-col h-full space-y-3">
                    <div class="flex items-center gap-4 text-sm shrink-0">
                        <span
                            >{{ $t('task.status') }}:
                            <a-tag :color="statusColor[detailRecord.status] || 'gray'">{{
                                $t(statusMap[detailRecord.status] || 'common.unknown')
                            }}</a-tag></span
                        >
                        <span
                            >{{ $t('task.startedAt') }}:
                            {{
                                detailRecord.started_at ? new Date(detailRecord.started_at).toLocaleString() : '-'
                            }}</span
                        >
                        <span
                            >{{ $t('task.finishedAt') }}:
                            {{
                                detailRecord.finished_at ? new Date(detailRecord.finished_at).toLocaleString() : '-'
                            }}</span
                        >
                    </div>
                    <div class="flex-1 flex flex-col min-h-0">
                        <div class="font-bold mb-2 shrink-0">{{ $t('task.log') }}</div>
                        <div
                            v-if="detailRecord.log"
                            class="flex-1 bg-gray-900 text-green-400 rounded-lg p-4 font-mono text-sm whitespace-pre-wrap overflow-y-auto"
                        >
                            {{ detailRecord.log }}
                        </div>
                        <div v-else class="text-gray-400 italic">{{ $t('task.noLog') }}</div>
                    </div>
                </div>
            </div>
        </div>
    </a-modal>
</template>
