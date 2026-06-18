<script setup lang="ts">
import {computed, ref} from 'vue'

type DiffLine = {
    type: 'same' | 'add' | 'remove'
    text: string
}

const emit = defineEmits<{
    confirm: [code: string]
}>()

const visible = ref(false)
const oldCode = ref('')
const newCode = ref('')

const buildDiff = (oldText: string, newText: string): DiffLine[] => {
    const oldLines = oldText.split('\n')
    const newLines = newText.split('\n')
    let start = 0
    while (start < oldLines.length && start < newLines.length && oldLines[start] === newLines[start]) {
        start++
    }
    let oldEnd = oldLines.length - 1
    let newEnd = newLines.length - 1
    while (oldEnd >= start && newEnd >= start && oldLines[oldEnd] === newLines[newEnd]) {
        oldEnd--
        newEnd--
    }
    const lines: DiffLine[] = []
    for (let i = Math.max(0, start - 4); i < start; i++) {
        lines.push({type: 'same', text: oldLines[i]})
    }
    for (let i = start; i <= oldEnd; i++) {
        lines.push({type: 'remove', text: oldLines[i]})
    }
    for (let i = start; i <= newEnd; i++) {
        lines.push({type: 'add', text: newLines[i]})
    }
    for (let i = oldEnd + 1; i < Math.min(oldLines.length, oldEnd + 5); i++) {
        if (i >= start && oldLines[i] === newLines[i + newEnd - oldEnd]) {
            lines.push({type: 'same', text: oldLines[i]})
        }
    }
    if (lines.length === 0) {
        lines.push({type: 'same', text: newText})
    }
    return lines
}

const diffLines = computed(() => buildDiff(oldCode.value, newCode.value))

const show = (oldValue: string, newValue: string) => {
    oldCode.value = oldValue
    newCode.value = newValue
    visible.value = true
}

const doConfirm = () => {
    emit('confirm', newCode.value)
    visible.value = false
}

defineExpose({show})
</script>

<template>
    <a-modal v-model:visible="visible" width="900px" :esc-to-close="false" :mask-closable="false" title-align="start">
        <template #title>
            <div class="font-bold">{{ $t('task.updatePreview') }}</div>
        </template>
        <template #footer>
            <a-button @click="visible = false">{{ $t('common.cancel') }}</a-button>
            <a-button type="primary" @click="doConfirm">{{ $t('task.applyUpdate') }}</a-button>
        </template>
        <div
            data-testid="task-update-diff"
            class="h-[60vh] overflow-auto rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs font-mono"
        >
            <div
                v-for="(line, index) in diffLines"
                :key="index"
                class="min-h-5 whitespace-pre-wrap break-all px-3 py-0.5"
                :class="{
                    'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-200': line.type === 'remove',
                    'bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-200': line.type === 'add',
                    'text-gray-700 dark:text-gray-300': line.type === 'same',
                }"
            >
                <span class="inline-block w-5 select-none text-gray-400 dark:text-gray-500">
                    {{ line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' ' }}
                </span>
                {{ line.text }}
            </div>
        </div>
    </a-modal>
</template>
