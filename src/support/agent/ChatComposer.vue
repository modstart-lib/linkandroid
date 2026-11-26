<script setup lang="ts">
import {computed, ref} from 'vue'
import {t} from '../../lang'
import {Dialog} from '../../lib/dialog'
import type {ChatImage} from './useChatImages'
import {CHAT_IMAGE_MAX} from './useChatImages'

const props = withDefaults(
    defineProps<{
        modelValue: string
        images: ChatImage[]
        loading?: boolean
        canSend?: boolean
        placeholder?: string
        /** Small text left of the actions, e.g. "select a model first". */
        notice?: string
        sendTestId?: string
    }>(),
    {
        loading: false,
        canSend: false,
        placeholder: '',
        notice: '',
        sendTestId: 'chat-send',
    },
)

const emit = defineEmits<{
    'update:modelValue': [value: string]
    send: []
    stop: []
    removeImage: [index: number]
    addFiles: [files: File[]]
    addDataUrl: [url: string]
}>()

const text = computed({
    get: () => props.modelValue,
    set: (value: string) => emit('update:modelValue', value),
})
const textareaRef = ref<any>(null)

defineExpose({
    focus: () => textareaRef.value?.focus?.(),
})

const onSend = () => {
    if (!props.canSend || props.loading) return
    emit('send')
}

const mimeOf = (name: string) => {
    const ext = name.split('.').pop()?.toLowerCase() || ''
    if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
    if (ext === 'webp') return 'image/webp'
    if (ext === 'gif') return 'image/gif'
    return 'image/png'
}

const toBytes = (raw: any): Uint8Array => {
    if (raw instanceof Uint8Array) return raw
    if (raw?.data) return new Uint8Array(raw.data)
    return new Uint8Array(raw || [])
}

const pickImages = async () => {
    const picked: any = await window.$mapi.file.openFile({
        filters: [{name: t('chatComposer.imageFilter'), extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif']}],
        properties: ['multiSelections'],
    })
    const paths: string[] = Array.isArray(picked) ? picked : picked ? [picked] : []
    const files: File[] = []
    for (const path of paths) {
        const buffer = await window.$mapi.file.readBuffer(path)
        const name = String(path).split(/[\\/]/).pop() || 'image.png'
        files.push(new File([toBytes(buffer)], name, {type: mimeOf(name)}))
    }
    if (files.length) {
        emit('addFiles', files)
        return
    }
    if (paths.length) Dialog.tipError(t('chatImage.failed'))
}

const pasteImage = async () => {
    const url = await window.$mapi.app.getClipboardImage()
    if (url) {
        emit('addDataUrl', String(url))
        return
    }
    Dialog.tipError(t('chatComposer.noClipboardImage'))
}
</script>

<template>
    <div
        class="rounded-2xl border border-gray-200 bg-white px-3 pb-2.5 pt-3 shadow-sm transition-colors focus-within:border-[rgb(var(--primary-4))] dark:border-gray-700 dark:bg-gray-800"
    >
        <div v-if="images.length" class="mb-2 flex flex-wrap gap-2" data-testid="chat-images">
            <div
                v-for="(image, index) in images"
                :key="image.key"
                class="inline-flex h-7 max-w-[14rem] items-center gap-1.5 rounded-lg border border-gray-200 bg-white pl-2 pr-1 text-xs text-gray-700 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200"
                data-testid="chat-image-chip"
            >
                <i-lucide-image class="h-3.5 w-3.5 shrink-0 text-emerald-500" aria-hidden="true" />
                <span class="min-w-0 truncate">{{ image.name }}</span>
                <button
                    type="button"
                    class="flex h-5 w-5 shrink-0 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--primary-6))] dark:hover:bg-gray-700 dark:hover:text-gray-200"
                    :aria-label="$t('chatImage.remove')"
                    :title="$t('chatImage.remove')"
                    data-testid="chat-image-remove"
                    @click="emit('removeImage', index)"
                >
                    <i-lucide-x class="h-3 w-3" aria-hidden="true" />
                </button>
            </div>
            <span class="self-center text-[11px] tabular-nums text-gray-500 dark:text-gray-400">
                {{ images.length }}/{{ CHAT_IMAGE_MAX }}
            </span>
        </div>

        <a-textarea
            ref="textareaRef"
            v-model="text"
            class="composer-input"
            :placeholder="placeholder"
            :auto-size="{minRows: 2, maxRows: 6}"
            @keydown.enter.exact.prevent="onSend"
        />

        <div class="mt-1.5 flex items-center gap-2">
            <a-dropdown trigger="click" position="tl">
                <button
                    type="button"
                    class="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-gray-600 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--primary-6))] dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                    :aria-label="$t('chatComposer.add')"
                    :title="$t('chatComposer.add')"
                    data-testid="chat-add-image"
                >
                    <i-lucide-plus class="h-4 w-4" aria-hidden="true" />
                </button>
                <template #content>
                    <a-doption @click="pickImages">
                        <template #icon><i-lucide-image-up /></template>
                        {{ $t('chatComposer.pick') }}
                    </a-doption>
                    <a-doption @click="pasteImage">
                        <template #icon><i-lucide-clipboard /></template>
                        {{ $t('chatComposer.paste') }}
                    </a-doption>
                </template>
            </a-dropdown>

            <span v-if="notice" class="min-w-0 truncate text-[11px] text-amber-700 dark:text-amber-400">
                {{ notice }}
            </span>

            <div class="ml-auto flex shrink-0 items-center gap-2">
                <slot name="model" />
                <button
                    v-if="loading"
                    type="button"
                    class="flex h-8 w-8 items-center justify-center rounded-full bg-gray-900 text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--primary-6))] dark:bg-gray-100 dark:text-gray-900"
                    :aria-label="$t('chatComposer.stop')"
                    :title="$t('chatComposer.stop')"
                    data-testid="chat-stop"
                    @click="emit('stop')"
                >
                    <i-lucide-square class="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                <button
                    v-else
                    type="button"
                    class="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-primary)] text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400 dark:disabled:bg-gray-700 dark:disabled:text-gray-500"
                    :disabled="!canSend"
                    :aria-label="$t('chatComposer.send')"
                    :title="$t('chatComposer.send')"
                    :data-testid="sendTestId"
                    @click="onSend"
                >
                    <i-lucide-arrow-up class="h-4 w-4" aria-hidden="true" />
                </button>
            </div>
        </div>
    </div>
</template>

<style scoped>
/* `.composer-input` is the Arco textarea wrapper itself, so style it directly. */
.composer-input {
    border: none !important;
    background: transparent !important;
    padding: 0 !important;
    border-radius: 0 !important;
    box-shadow: none !important;
}

.composer-input :deep(.arco-textarea) {
    padding: 2px 2px 6px !important;
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
    resize: none;
    font-size: 14px;
    line-height: 1.6;
}
</style>
