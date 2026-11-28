<script setup lang="ts">
import {computed, ref} from 'vue'
import {t} from '../../lang'
import {Dialog} from '../../lib/dialog'
import {mapError} from '../../lib/error'
import CodeDiffView from '../../components/common/CodeDiffView.vue'
import {buildLineDiff, diffStats, type DiffLine} from '../../lib/diff'

type HistorySource = 'baseline' | 'repair' | 'chat' | 'restore'

type HistoryVersion = {
    seq: number
    at: string
    source: HistorySource
    sessionId: number
    refId: string
    taskName: string
    added: number
    removed: number
    size: number
}

type HistoryTarget = {
    uuid: string
    name: string
}

const emit = defineEmits<{
    restored: [code: string]
    read: []
}>()

const visible = ref(false)
const loading = ref(false)
const restoring = ref(false)
const target = ref<HistoryTarget | null>(null)
const versions = ref<HistoryVersion[]>([])
const activeSeq = ref(-1)
const activeDiff = ref<DiffLine[]>([])
const activeTitle = ref('')

const sourceLabel = (source: HistorySource) => {
    if (source === 'repair') return t('task.history.sourceRepair')
    if (source === 'chat') return t('task.history.sourceChat')
    if (source === 'restore') return t('task.history.sourceRestore')
    return t('task.history.baseline')
}

const formatTime = (value: string) => {
    try {
        return new Date(value).toLocaleString()
    } catch {
        return value || ''
    }
}

const load = async () => {
    if (!target.value?.uuid) return
    loading.value = true
    activeSeq.value = -1
    activeDiff.value = []
    try {
        const data = await window.$mapi.history.list(target.value.uuid)
        versions.value = data.versions || []
        if (versions.value.length > 0) {
            await window.$mapi.history.markRead(target.value.uuid)
            emit('read')
        }
    } catch (e: any) {
        Dialog.tipError(mapError(e))
        versions.value = []
    } finally {
        loading.value = false
    }
}

const doCompare = async (version: HistoryVersion) => {
    if (!target.value?.uuid) return
    try {
        const payload = await window.$mapi.history.read(target.value.uuid, version.seq)
        activeSeq.value = version.seq
        activeDiff.value = payload?.diff || []
        activeTitle.value = `${sourceLabel(version.source)} · ${formatTime(version.at)}`
    } catch (e: any) {
        Dialog.tipError(mapError(e))
    }
}

const doRestore = (version: HistoryVersion) => {
    if (!target.value?.uuid || restoring.value) return
    Dialog.confirm(t('task.history.restoreConfirm')).then(async () => {
        restoring.value = true
        try {
            const payload = await window.$mapi.history.read(target.value!.uuid, version.seq)
            if (!payload) {
                Dialog.tipError(t('task.history.restoreFailed', {error: 'NotFound'}))
                return
            }
            const row = await window.$mapi.db.first('SELECT * FROM task WHERE uuid = ?', [target.value!.uuid])
            if (!row) {
                Dialog.tipError(t('task.history.restoreFailed', {error: 'TaskNotFound'}))
                return
            }
            if ((row.code || '') !== payload.code) {
                const diff = buildLineDiff(row.code || '', payload.code)
                await window.$mapi.history
                    .record({
                        uuid: target.value!.uuid,
                        taskName: row.name,
                        source: 'restore',
                        previousCode: row.code || '',
                        nextCode: payload.code,
                        diff,
                        stats: diffStats(diff),
                    })
                    .catch(() => {})
            }
            await window.$mapi.project.save({
                id: row.id,
                name: row.name,
                description: row.description || '',
                requirement: row.requirement || '',
                code: payload.code,
                language: row.language || 'python',
            })
            await window.$mapi.history.markRead(target.value!.uuid).catch(() => {})
            Dialog.tipSuccess(t('task.history.restoreSuccess'))
            emit('restored', payload.code)
            visible.value = false
        } catch (e: any) {
            Dialog.tipError(t('task.history.restoreFailed', {error: mapError(e)}))
        } finally {
            restoring.value = false
        }
    })
}

const show = (value: HistoryTarget) => {
    target.value = value
    visible.value = true
    load().then()
}

const activeVersion = computed(() => versions.value.find((item) => item.seq === activeSeq.value) || null)

defineExpose({show})
</script>

<template>
    <a-modal v-model:visible="visible" width="min(1000px, 95vw)" :footer="false" title-align="start">
        <template #title>
            <div class="font-bold">
                {{ $t('task.history.title') }}
                <span class="text-sm font-normal text-gray-400 ml-1">- {{ target?.name || '' }}</span>
            </div>
        </template>
        <div style="height: calc(100vh - 15rem)" class="flex flex-col gap-3">
            <div class="shrink-0 text-xs text-gray-500 dark:text-gray-400">
                {{ $t('task.history.retention', {count: 50}) }}
            </div>
            <a-spin :loading="loading" class="flex-1 min-h-0">
                <div v-if="versions.length === 0" class="h-full flex items-center justify-center">
                    <a-empty :description="$t('task.history.empty')" />
                </div>
                <div v-else class="h-full flex flex-col md:flex-row gap-3 min-h-0">
                    <div class="md:w-1/2 min-h-0 overflow-auto space-y-2 pr-1">
                        <div
                            v-for="version in versions"
                            :key="version.seq"
                            class="rounded-lg border p-3 transition-colors"
                            :class="
                                version.seq === activeSeq
                                    ? 'border-blue-300 bg-blue-50/60 dark:border-blue-700 dark:bg-blue-950/30'
                                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                            "
                        >
                            <div class="flex items-center gap-2 flex-wrap">
                                <a-tag :color="version.source === 'repair' ? 'orange' : 'arcoblue'" size="small">
                                    {{ sourceLabel(version.source) }}
                                </a-tag>
                                <span class="text-xs text-gray-500 dark:text-gray-400">
                                    {{ formatTime(version.at) }}
                                </span>
                                <span class="text-xs text-gray-500 dark:text-gray-400">
                                    +{{ version.added }} −{{ version.removed }}
                                </span>
                                <div class="ml-auto flex items-center gap-1">
                                    <a-button
                                        v-if="version.source !== 'baseline'"
                                        type="text"
                                        @click="doCompare(version)"
                                    >
                                        {{ $t('task.history.compare') }}
                                    </a-button>
                                    <a-button
                                        type="text"
                                        status="warning"
                                        :disabled="restoring"
                                        @click="doRestore(version)"
                                    >
                                        {{ $t('task.history.restore') }}
                                    </a-button>
                                </div>
                            </div>
                            <div class="mt-1 text-xs text-gray-400 dark:text-gray-500">
                                {{ version.source === 'baseline' ? $t('task.history.baselineHint') : '' }}
                            </div>
                        </div>
                    </div>
                    <div class="md:w-1/2 min-h-0 flex flex-col">
                        <div class="shrink-0 text-sm text-gray-600 dark:text-gray-300 mb-2">
                            {{ activeVersion ? activeTitle : $t('task.history.selectHint') }}
                        </div>
                        <CodeDiffView
                            v-if="activeVersion"
                            :lines="activeDiff"
                            height-class="flex-1 min-h-0"
                            class="min-h-0"
                        />
                    </div>
                </div>
            </a-spin>
        </div>
    </a-modal>
</template>
