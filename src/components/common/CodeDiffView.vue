<script setup lang="ts">
import type {DiffLine} from '../../lib/diff'

withDefaults(
    defineProps<{
        lines: DiffLine[]
        heightClass?: string
        testId?: string
    }>(),
    {
        heightClass: 'h-[60vh]',
        testId: '',
    },
)
</script>

<template>
    <div
        :data-testid="testId || undefined"
        class="overflow-auto rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs font-mono"
        :class="heightClass"
    >
        <div v-if="!lines.length" class="p-4 text-gray-400 dark:text-gray-500">
            {{ $t('task.history.noDiff') }}
        </div>
        <div
            v-for="(line, index) in lines"
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
</template>
