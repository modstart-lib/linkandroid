<script setup lang="ts">
import {computed, nextTick, onBeforeUnmount, onMounted, onUpdated, ref, watch} from 'vue'

const props = withDefaults(
    defineProps<{
        items: any[]
        itemKey: (item: any) => string | number
        estimatedHeight?: number
        gap?: number
        overscan?: number
        /** 新内容加入时是否自动贴底（会话列表传 false，保持顶部） */
        autoStickBottom?: boolean
    }>(),
    {
        estimatedHeight: 120,
        gap: 10,
        overscan: 5,
        autoStickBottom: true,
    },
)

const emit = defineEmits<{
    stickChange: [boolean]
}>()

const viewport = ref<HTMLElement | null>(null)
const heights = ref<Record<string, number>>({})
const scrollTop = ref(0)
const viewportHeight = ref(600)
const stickBottom = ref(props.autoStickBottom)
let resizeObserver: ResizeObserver | null = null

const keyOf = (item: any) => String(props.itemKey(item))
const heightOf = (key: string) => heights.value[key] || props.estimatedHeight

/** Single place to update the "pinned to bottom" state, so the owner can show a jump-back button. */
const setStickBottom = (value: boolean) => {
    if (stickBottom.value === value) return
    stickBottom.value = value
    emit('stickChange', value)
}

/** Cumulative top offset for every item, based on measured heights (estimate until measured). */
const offsets = computed(() => {
    const list: number[] = new Array(props.items.length)
    let total = 0
    for (let index = 0; index < props.items.length; index++) {
        list[index] = total
        total += heightOf(keyOf(props.items[index])) + props.gap
    }
    return list
})

const totalHeight = computed(() => {
    const count = props.items.length
    if (!count) return 0
    return offsets.value[count - 1] + heightOf(keyOf(props.items[count - 1]))
})

const findIndex = (top: number) => {
    const list = offsets.value
    let low = 0
    let high = list.length - 1
    let found = 0
    while (low <= high) {
        const mid = (low + high) >> 1
        if (list[mid] <= top) {
            found = mid
            low = mid + 1
        } else {
            high = mid - 1
        }
    }
    return found
}

const startIndex = computed(() => Math.max(0, findIndex(scrollTop.value) - props.overscan))
const endIndex = computed(() =>
    Math.min(props.items.length, findIndex(scrollTop.value + viewportHeight.value) + props.overscan + 1),
)

const visibleItems = computed(() =>
    props.items.slice(startIndex.value, endIndex.value).map((item, offset) => {
        const index = startIndex.value + offset
        return {item, index, key: keyOf(item), top: offsets.value[index] || 0}
    }),
)

const scrollToBottom = () => {
    void nextTick(() => {
        const el = viewport.value
        if (!el) return
        el.scrollTop = el.scrollHeight
        scrollTop.value = el.scrollTop
        setStickBottom(true)
    })
}

/** Measure rendered items and correct estimates; keeps the view pinned to the bottom when it was. */
const measureAll = () => {
    const el = viewport.value
    if (!el) return
    let changed = false
    for (const node of Array.from(el.querySelectorAll<HTMLElement>('[data-vkey]'))) {
        const key = node.dataset.vkey
        if (!key) continue
        const height = Math.ceil(node.getBoundingClientRect().height)
        if (height <= 0) continue
        if (Math.abs((heights.value[key] || 0) - height) > 0.5) {
            heights.value[key] = height
            changed = true
        }
    }
    if (changed && stickBottom.value) scrollToBottom()
}

const onScroll = () => {
    const el = viewport.value
    if (!el) return
    scrollTop.value = el.scrollTop
    setStickBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 48)
}

watch(
    () => props.items.length,
    () => {
        void nextTick(() => {
            measureAll()
            if (stickBottom.value) scrollToBottom()
        })
    },
)

watch(
    () => (props.items.length ? keyOf(props.items[0]) : ''),
    () => {
        heights.value = {}
        scrollTop.value = 0
        setStickBottom(props.autoStickBottom)
    },
)

onMounted(() => {
    const el = viewport.value
    if (!el) return
    viewportHeight.value = el.clientHeight || 600
    resizeObserver = new ResizeObserver(() => {
        viewportHeight.value = el.clientHeight || 600
        measureAll()
    })
    resizeObserver.observe(el)
    void nextTick(measureAll)
})

onUpdated(() => {
    void nextTick(measureAll)
})

onBeforeUnmount(() => {
    resizeObserver?.disconnect()
    resizeObserver = null
})

defineExpose({scrollToBottom, measureAll})
</script>

<template>
    <div ref="viewport" class="relative h-full overflow-y-auto" data-virtual-list @scroll.passive="onScroll">
        <div :style="{height: `${totalHeight}px`, position: 'relative'}">
            <div
                v-for="entry in visibleItems"
                :key="entry.key"
                :data-vkey="entry.key"
                :style="{position: 'absolute', top: `${entry.top}px`, left: 0, right: 0}"
            >
                <slot :item="entry.item" :index="entry.index"></slot>
            </div>
        </div>
    </div>
</template>
