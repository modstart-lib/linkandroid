<script setup lang="ts">
import {computed, ref} from 'vue'
import CodeDiffView from '../../components/common/CodeDiffView.vue'
import {buildLineDiff, type DiffLine} from '../../lib/diff'

export type PreviewMeta = {
    source: 'chat'
    taskUuid: string
    sessionId: number
    oldCode: string
}

const emit = defineEmits<{
    confirm: [code: string, meta?: PreviewMeta]
}>()

const visible = ref(false)
const oldCode = ref('')
const newCode = ref('')
const meta = ref<PreviewMeta | null>(null)

const diffLines = computed<DiffLine[]>(() => buildLineDiff(oldCode.value, newCode.value))

const show = (oldValue: string, newValue: string, value?: PreviewMeta) => {
    oldCode.value = oldValue
    newCode.value = newValue
    meta.value = value || null
    visible.value = true
}

const doConfirm = () => {
    emit('confirm', newCode.value, meta.value || undefined)
    visible.value = false
}

defineExpose({show})
</script>

<template>
    <a-modal
        v-model:visible="visible"
        width="min(900px, 95vw)"
        :esc-to-close="false"
        :mask-closable="false"
        title-align="start"
    >
        <template #title>
            <div class="font-bold">{{ $t('task.updatePreview') }}</div>
        </template>
        <template #footer>
            <a-button @click="visible = false">{{ $t('common.cancel') }}</a-button>
            <a-button type="primary" @click="doConfirm">{{ $t('task.applyUpdate') }}</a-button>
        </template>
        <CodeDiffView :lines="diffLines" test-id="task-update-diff" />
    </a-modal>
</template>
