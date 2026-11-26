<script setup lang="ts">
import {computed, ref} from 'vue'
import type {TaskFileItem} from './useTaskFiles'

const props = defineProps<{
    files: TaskFileItem[]
    activePath: string
    entry: string
    dirtyPaths: string[]
    disabled?: boolean
}>()

const emit = defineEmits<{
    select: [path: string]
    create: [path: string]
    rename: [fromPath: string, toPath: string]
    remove: [path: string]
}>()

const nameVisible = ref(false)
const nameValue = ref('')
const renameFrom = ref('')

const isDirty = (path: string) => props.dirtyPaths.indexOf(path) >= 0
const isEntry = (path: string) => path === props.entry
const canRemove = (path: string) => !isEntry(path)
const canRename = (path: string) => !isEntry(path)

const showCreate = () => {
    if (props.disabled) return
    renameFrom.value = ''
    nameValue.value = ''
    nameVisible.value = true
}

const showRename = (path: string) => {
    if (props.disabled || !canRename(path)) return
    renameFrom.value = path
    nameValue.value = path
    nameVisible.value = true
}

const confirmName = () => {
    const value = nameValue.value.trim()
    if (!value) return
    if (renameFrom.value) {
        if (value !== renameFrom.value) emit('rename', renameFrom.value, value)
    } else {
        emit('create', value)
    }
    nameVisible.value = false
}

const shortcutHint = computed(() => (props.disabled ? '保存任务后可管理多个文件' : '入口文件 main.py 不能被删除或改名'))
</script>

<template>
    <div class="flex flex-col h-full bg-white dark:bg-gray-900" data-testid="task-files-panel">
        <div
            class="shrink-0 flex items-center justify-between gap-1 px-2 py-2 border-b border-gray-200 dark:border-gray-700"
        >
            <span class="text-xs font-medium text-gray-500 dark:text-gray-400">项目文件</span>
            <a-tooltip :content="$t('task.file.add')">
                <a-button
                    type="text"
                    size="mini"
                    :disabled="disabled"
                    :aria-label="$t('task.file.add')"
                    data-testid="task-file-add"
                    @click="showCreate"
                >
                    <template #icon><i-lucide-file-plus /></template>
                </a-button>
            </a-tooltip>
        </div>

        <div class="flex-1 min-h-0 overflow-y-auto py-1" data-testid="task-file-list">
            <div
                v-for="file in files"
                :key="file.path"
                class="group mx-1 flex items-center gap-1.5 pl-2 pr-1 py-1.5 rounded-md cursor-pointer text-xs"
                :class="
                    file.path === activePath
                        ? 'bg-[rgb(var(--primary-1))] text-[rgb(var(--primary-6))]'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                "
                :title="file.path"
                :data-testid="`task-file-${file.path}`"
                @click="emit('select', file.path)"
            >
                <i-lucide-file-code class="w-3.5 h-3.5 shrink-0 opacity-70" aria-hidden="true" />
                <span class="flex-1 min-w-0 truncate">{{ file.path }}</span>
                <span
                    v-if="isEntry(file.path)"
                    class="shrink-0 text-[10px] px-1 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                >
                    {{ $t('task.file.entry') }}
                </span>
                <span
                    v-if="isDirty(file.path)"
                    class="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0"
                    :title="$t('task.file.unsaved')"
                />
                <span class="hidden group-hover:flex items-center shrink-0">
                    <a-button
                        v-if="canRename(file.path)"
                        type="text"
                        size="mini"
                        :aria-label="$t('task.file.rename')"
                        @click.stop="showRename(file.path)"
                    >
                        <template #icon><i-lucide-pencil /></template>
                    </a-button>
                    <a-button
                        v-if="canRemove(file.path)"
                        type="text"
                        size="mini"
                        status="danger"
                        :aria-label="$t('task.file.delete')"
                        @click.stop="emit('remove', file.path)"
                    >
                        <template #icon><i-lucide-trash-2 /></template>
                    </a-button>
                </span>
            </div>
        </div>

        <div
            class="shrink-0 px-2 py-1.5 border-t border-gray-200 dark:border-gray-700 text-[10px] leading-relaxed text-gray-400"
        >
            {{ shortcutHint }}
        </div>

        <a-modal v-model:visible="nameVisible" width="min(480px, 90vw)" :footer="false" title-align="start">
            <template #title>
                <div class="font-bold">
                    {{ renameFrom ? $t('task.file.rename') : $t('task.file.add') }}
                </div>
            </template>
            <div class="py-2 flex flex-col gap-3">
                <a-input
                    v-model="nameValue"
                    :placeholder="$t('task.file.pathPlaceholder')"
                    allow-clear
                    data-testid="task-file-name"
                    @press-enter="confirmName"
                />
                <div class="text-xs text-gray-400">{{ $t('task.file.pathHint') }}</div>
                <div class="flex justify-end gap-2">
                    <a-button @click="nameVisible = false">{{ $t('common.cancel') }}</a-button>
                    <a-button type="primary" data-testid="task-file-name-confirm" @click="confirmName">
                        {{ $t('common.confirm') }}
                    </a-button>
                </div>
            </div>
        </a-modal>
    </div>
</template>
