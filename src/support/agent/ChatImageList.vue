<script setup lang="ts">
import {t} from '../../lang'
import type {ChatImage} from './useChatImages'
import {CHAT_IMAGE_MAX} from './useChatImages'

withDefaults(
    defineProps<{
        images: ChatImage[]
        removable?: boolean
        /** sm: composer thumbnails; md: larger previews inside a message bubble */
        size?: 'sm' | 'md'
    }>(),
    {
        removable: false,
        size: 'sm',
    },
)

const emit = defineEmits<{
    remove: [index: number]
}>()
</script>

<template>
    <div v-if="images.length" class="flex flex-wrap items-center gap-2" data-testid="chat-images">
        <span
            v-if="removable"
            class="shrink-0 rounded bg-[rgba(234,0,86,0.08)] px-1.5 py-0.5 text-[11px] font-medium text-[#c3004e] dark:bg-[rgba(238,36,103,0.16)] dark:text-[#ff8fb0]"
        >
            {{ t('chatImage.pending') }}
        </span>
        <div
            v-for="(image, index) in images"
            :key="image.key"
            :class="
                size === 'sm'
                    ? 'relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50 ring-1 ring-black/5 dark:border-gray-700 dark:bg-gray-900 dark:ring-white/10'
                    : 'relative'
            "
        >
            <img
                :src="image.url"
                alt=""
                :class="
                    size === 'sm'
                        ? 'h-full w-full object-cover object-top'
                        : 'max-h-56 w-auto rounded-lg border border-gray-200 object-contain ring-1 ring-black/5 dark:border-gray-700 dark:ring-white/10'
                "
            />
            <button
                v-if="removable"
                type="button"
                class="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/75 text-white ring-1 ring-white/70 after:absolute after:-inset-1 after:content-[''] hover:bg-black/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--primary-6))]"
                :aria-label="$t('chatImage.remove')"
                :title="$t('chatImage.remove')"
                data-testid="chat-image-remove"
                @click="emit('remove', index)"
            >
                <i-lucide-x class="h-3.5 w-3.5" aria-hidden="true" />
            </button>
        </div>
        <span v-if="removable" class="text-[11px] tabular-nums text-gray-500 dark:text-gray-400">
            {{ images.length }}/{{ CHAT_IMAGE_MAX }}
        </span>
    </div>
</template>
