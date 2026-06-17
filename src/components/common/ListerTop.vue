<script setup lang="ts">
import {computed, ref, useSlots} from 'vue'

defineProps<{
    loading?: boolean
}>()

const emit = defineEmits<{
    refresh: []
}>()

const filterExpanded = ref(false)
const slots = useSlots()
const hasFilters = computed(() => !!slots.default)
</script>

<template>
    <div class="mb-4">
        <!-- 大屏幕（md+）：筛选项左侧换行，操作区固定右上角 -->
        <div class="hidden md:grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-2">
            <div class="flex flex-wrap items-center gap-2">
                <slot />
            </div>
            <div class="flex items-center gap-2 flex-shrink-0">
                <a-button :loading="loading" @click="emit('refresh')">
                    <template #icon>
                        <icon-refresh />
                    </template>
                    {{ $t('common.refresh') }}
                </a-button>
                <slot name="actions" />
            </div>
        </div>

        <!-- 小屏幕：展开/筛选布局 -->
        <div class="flex gap-2 md:hidden">
            <a-button v-if="hasFilters" class="flex-1" @click="filterExpanded = !filterExpanded">
                <template #icon>
                    <icon-filter />
                </template>
                {{ $t('listerTop.filter') }}
            </a-button>
            <a-button class="flex-1" :loading="loading" @click="emit('refresh')">
                <template #icon>
                    <icon-refresh />
                </template>
                {{ $t('common.refresh') }}
            </a-button>
            <div class="flex flex-1 gap-2 [&>*]:flex-1">
                <slot name="actions" />
            </div>
        </div>

        <!-- 小屏幕展开筛选内容 -->
        <div v-if="filterExpanded" class="flex flex-col gap-2 mt-2 md:hidden">
            <slot />
        </div>
    </div>
</template>
