<script setup lang="ts">
import {computed, onMounted, ref, watch} from 'vue'
import {t} from '../../lang'

type HistorySource = 'baseline' | 'repair' | 'chat' | 'restore'

type HistoryVersion = {
    seq: number
    at: string
    source: HistorySource
    added: number
    removed: number
}

const props = defineProps<{
    uuid: string
    refreshToken?: number
}>()

const emit = defineEmits<{
    showHistory: []
    dismissed: []
}>()

const meta = ref<HistoryVersion | null>(null)
const visible = computed(() => !!meta.value && !!props.uuid)

const sourceLabel = (source: HistorySource) =>
    source === 'repair' ? t('task.history.sourceRepair') : t('task.history.sourceChat')

const formatTime = (value: string) => {
    try {
        return new Date(value).toLocaleString()
    } catch {
        return value || ''
    }
}

const load = async () => {
    meta.value = null
    if (!props.uuid) return
    try {
        const data = await window.$mapi.history.list(props.uuid)
        const latest = data.versions?.[0]
        if (!latest || latest.seq <= data.readSeq) return
        if (latest.source !== 'repair' && latest.source !== 'chat') return
        meta.value = latest
    } catch {
        meta.value = null
    }
}

const dismiss = async () => {
    if (props.uuid) {
        await window.$mapi.history.markRead(props.uuid).catch(() => {})
    }
    meta.value = null
    emit('dismissed')
}

const doShowHistory = () => {
    dismiss().then(() => emit('showHistory'))
}

onMounted(load)
watch(() => props.uuid, load)
watch(() => props.refreshToken, load)
</script>

<template>
    <div
        v-if="visible && meta"
        class="shrink-0 mb-2 rounded-lg border border-blue-200 bg-blue-50/70 px-3 py-2 dark:border-blue-800 dark:bg-blue-950/40"
    >
        <div class="flex items-start gap-2">
            <i-lucide-bot class="w-4 h-4 mt-0.5 text-blue-500 shrink-0" aria-hidden="true" />
            <div class="flex-1 min-w-0 text-xs text-blue-800 dark:text-blue-200">
                {{
                    $t('task.history.notice', {
                        source: sourceLabel(meta.source),
                        time: formatTime(meta.at),
                        added: meta.added,
                        removed: meta.removed,
                    })
                }}
            </div>
            <div class="flex items-center gap-1 shrink-0">
                <a-button type="text" size="mini" @click="doShowHistory">
                    {{ $t('task.history.viewHistory') }}
                </a-button>
                <a-button type="text" size="mini" @click="dismiss">
                    {{ $t('task.history.dismiss') }}
                </a-button>
            </div>
        </div>
    </div>
</template>
