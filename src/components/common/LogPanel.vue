<script setup lang="ts">
import {computed, nextTick, ref} from 'vue'
import {t} from '../../lang'

type LogType = 'info' | 'error' | 'system'

const props = withDefaults(
    defineProps<{
        title?: string
        emptyText?: string
        running?: boolean
        showHeader?: boolean
        textSize?: 'xs' | 'sm'
    }>(),
    {
        title: t('task.runLog'),
        emptyText: t('empty.noLog'),
        running: false,
        showHeader: true,
        textSize: 'xs',
    },
)

const contentRef = ref<HTMLElement | null>(null)
const logContent = ref('')
const autoScroll = ref(true)
const wordWrap = ref(true)

const hasLog = computed(() => logContent.value.length > 0)
const textSizeClass = computed(() => (props.textSize === 'sm' ? 'text-sm' : 'text-xs'))
const logHtml = computed(() => {
    const cursor = props.running
        ? '<span class="inline-block w-2 h-4 bg-green-400 animate-pulse ml-0.5 align-bottom"></span>'
        : ''
    return logContent.value + cursor
})

const htmlEscape = (text: string): string => {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const timestamp = () => {
    const d = new Date()
    const pad = (n: number) => n.toString().padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

const formatLine = (text: string, type: LogType) => {
    const typeClass = type === 'error' ? 'text-red-400' : type === 'system' ? 'text-cyan-400' : 'text-green-400'
    return `<span class="text-gray-500">${timestamp()}</span> <span class="${typeClass}">${htmlEscape(text)}</span>\n`
}

const scrollToBottom = () => {
    if (!autoScroll.value) return
    nextTick(() => {
        if (contentRef.value) contentRef.value.scrollTop = contentRef.value.scrollHeight
    })
}

const printLine = (text: string, type: LogType = 'info') => {
    logContent.value += formatLine(text, type)
    scrollToBottom()
}

const printChunk = (chunk: string, type: Exclude<LogType, 'system'> = 'info') => {
    const lines = chunk.split('\n')
    if (lines.length > 0 && lines[lines.length - 1] === '') {
        lines.pop()
    }
    logContent.value += lines.map((line) => (line.length > 0 ? formatLine(line, type) : '\n')).join('')
    scrollToBottom()
}

const clear = () => {
    logContent.value = ''
}

const getPlainText = () => logContent.value.replace(/<[^>]*>/g, '')

defineExpose({
    clear,
    getPlainText,
    printChunk,
    printError: (text: string) => printLine(text, 'error'),
    printErrorChunk: (text: string) => printChunk(text, 'error'),
    printLog: (text: string) => printLine(text, 'info'),
    printLogChunk: (text: string) => printChunk(text, 'info'),
    printSystem: (text: string) => printLine(text, 'system'),
})
</script>

<template>
    <div class="h-full flex flex-col overflow-hidden">
        <div
            v-if="showHeader"
            class="shrink-0 flex items-center justify-between gap-3 px-4 py-1.5 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700"
        >
            <div class="flex items-center gap-3 min-w-0">
                <span class="text-xs font-medium text-gray-600 dark:text-gray-400 shrink-0">
                    <i-lucide-workflow class="inline-block mr-1" />
                    {{ title }}
                </span>
                <label class="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 shrink-0">
                    <a-switch v-model="autoScroll" />
                    <span>{{ $t('log.autoScroll') }}</span>
                </label>
                <label class="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 shrink-0">
                    <a-switch v-model="wordWrap" />
                    <span>{{ $t('log.wordWrap') }}</span>
                </label>
            </div>
            <slot name="actions" :clear="clear" :has-log="hasLog" />
        </div>
        <pre
            v-if="hasLog || running"
            ref="contentRef"
            class="flex-1 overflow-auto p-3 font-mono leading-relaxed m-0 bg-gray-900"
            :class="textSizeClass"
            :style="{
                whiteSpace: wordWrap ? 'pre-wrap' : 'pre',
                wordBreak: wordWrap ? 'break-all' : 'normal',
            }"
            v-html="logHtml"
        ></pre>
        <div
            v-else
            class="flex-1 flex items-center justify-center p-3 font-mono m-0 bg-gray-900 text-gray-500"
            :class="textSizeClass"
        >
            {{ emptyText }}
        </div>
    </div>
</template>
