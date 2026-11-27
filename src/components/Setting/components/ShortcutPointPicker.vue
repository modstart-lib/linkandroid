<script setup lang="ts">
import {computed, ref, watch} from 'vue'

const props = defineProps<{
    visible: boolean
    image?: string | null
    devices: Array<{id: string; name: string}>
    deviceId: string
    loading: boolean
    mode?: 'point' | 'swipe'
    x: number
    y: number
    x2?: number
    y2?: number
}>()

const emit = defineEmits(['update:visible', 'select-device', 'change'])

const imageRef = ref<HTMLImageElement | null>(null)
const point = ref({x: props.x, y: props.y})
const point2 = ref({x: props.x2 ?? 0.5, y: props.y2 ?? 0.2})
// 滑动模式：第一次点击落起点，第二次点击落终点
const swipeStage = ref<'start' | 'end'>('start')

const isSwipe = computed(() => props.mode === 'swipe')

const deviceOptions = computed(() => {
    return props.devices.map((one) => ({label: one.name || one.id, value: one.id}))
})

watch(
    () => [props.x, props.y, props.x2, props.y2, props.visible],
    () => {
        point.value = {x: props.x, y: props.y}
        point2.value = {x: props.x2 ?? 0.5, y: props.y2 ?? 0.2}
        swipeStage.value = 'start'
    },
)

const doClose = () => {
    emit('update:visible', false)
}

const onSelectDevice = (value: string) => {
    emit('select-device', value)
}

const pickRatio = (event: MouseEvent) => {
    const target = imageRef.value
    if (!target) {
        return null
    }
    const rect = target.getBoundingClientRect()
    if (!rect.width || !rect.height) {
        return null
    }
    return {
        x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
        y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    }
}

const doPick = (event: MouseEvent) => {
    const ratio = pickRatio(event)
    if (!ratio) {
        return
    }
    if (!isSwipe.value) {
        point.value = ratio
        return
    }
    if (swipeStage.value === 'start') {
        point.value = ratio
        swipeStage.value = 'end'
    } else {
        point2.value = ratio
        swipeStage.value = 'start'
    }
}

const doConfirm = () => {
    if (isSwipe.value) {
        emit('change', {x: point.value.x, y: point.value.y, x2: point2.value.x, y2: point2.value.y})
    } else {
        emit('change', {x: point.value.x, y: point.value.y})
    }
    doClose()
}

const percent = (value: number) => `${Math.round(value * 100)}%`

const pointText = computed(() => {
    if (!isSwipe.value) {
        return `${percent(point.value.x)}, ${percent(point.value.y)}`
    }
    return `${percent(point.value.x)}, ${percent(point.value.y)} → ${percent(point2.value.x)}, ${percent(point2.value.y)}`
})

const lineStyle = computed(() => {
    return {
        x1: `${point.value.x * 100}%`,
        y1: `${point.value.y * 100}%`,
        x2: `${point2.value.x * 100}%`,
        y2: `${point2.value.y * 100}%`,
    }
})
</script>

<template>
    <a-modal :visible="props.visible" width="min(620px, 94vw)" :footer="false" title-align="start" @cancel="doClose">
        <template #title>
            <div class="font-bold">
                {{ isSwipe ? $t('setting.shortcut.swipeTitle') : $t('setting.shortcut.pointTitle') }}
            </div>
        </template>
        <div class="p-2">
            <div v-if="props.devices.length" class="mb-3 flex items-center gap-2">
                <span class="text-sm whitespace-nowrap">{{ $t('setting.shortcut.pickDevice') }}</span>
                <a-select
                    :model-value="props.deviceId"
                    class="flex-1"
                    :options="deviceOptions"
                    :disabled="props.devices.length < 2"
                    @change="onSelectDevice"
                />
            </div>
            <div v-if="props.loading" class="py-10 text-center text-sm text-gray-500">
                <a-spin />
                <div class="mt-2">{{ $t('setting.shortcut.capturing') }}</div>
            </div>
            <div v-else-if="props.image" class="flex justify-center">
                <div
                    class="relative inline-block rounded-lg overflow-hidden border border-solid border-gray-200 dark:border-gray-700"
                >
                    <img
                        ref="imageRef"
                        :src="props.image"
                        class="block max-h-[52vh] max-w-full cursor-crosshair select-none"
                        draggable="false"
                        :alt="$t('setting.shortcut.deviceImage')"
                        @click="doPick"
                    />
                    <svg v-if="isSwipe" class="absolute inset-0 w-full h-full pointer-events-none">
                        <line
                            :x1="lineStyle.x1"
                            :y1="lineStyle.y1"
                            :x2="lineStyle.x2"
                            :y2="lineStyle.y2"
                            stroke="#f53f3f"
                            stroke-width="2"
                            stroke-dasharray="6 4"
                        />
                    </svg>
                    <div
                        class="absolute w-4 h-4 -ml-2 -mt-2 rounded-full border-2 border-solid border-white bg-red-500 shadow"
                        :style="{left: point.x * 100 + '%', top: point.y * 100 + '%'}"
                    ></div>
                    <div
                        v-if="isSwipe"
                        class="absolute w-4 h-4 -ml-2 -mt-2 rounded-full border-2 border-solid border-white bg-blue-500 shadow"
                        :style="{left: point2.x * 100 + '%', top: point2.y * 100 + '%'}"
                    ></div>
                </div>
            </div>
            <a-empty v-else :description="$t('setting.shortcut.pointEmpty')" />
            <div class="mt-3 flex items-center justify-between">
                <div class="text-xs text-gray-500">
                    {{ isSwipe ? $t('setting.shortcut.swipeHint') : $t('setting.shortcut.pointTip') }}
                    <span v-if="props.image" class="ml-2">{{ pointText }}</span>
                </div>
                <a-space>
                    <a-button @click="doClose">{{ $t('common.cancel') }}</a-button>
                    <a-button type="primary" :disabled="!props.image" @click="doConfirm">
                        {{ $t('common.confirm') }}
                    </a-button>
                </a-space>
            </div>
        </div>
    </a-modal>
</template>
