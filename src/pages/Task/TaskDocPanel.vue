<script setup lang="ts">
import {computed, nextTick, onMounted, onUnmounted, ref} from 'vue'
import {MarkdownUtil, parseToc, type TocItem} from '../../lib/markdown'
import manualMd from './Manual.md?raw'

// --- Markdown rendering ---

const htmlContent = computed(() => {
    return MarkdownUtil.toHtml(manualMd)
})

// --- TOC parsing ---

const toc = computed<TocItem[]>(() => {
    return parseToc(manualMd)
})

// --- Sidebar collapse state ---

// Track collapsed H2 sections by their id
const collapsedSections = ref<Set<string>>(new Set())

const toggleCollapse = (id: string) => {
    const next = new Set(collapsedSections.value)
    if (next.has(id)) {
        next.delete(id)
    } else {
        next.add(id)
    }
    collapsedSections.value = next
}

const isCollapsed = (id: string): boolean => {
    return collapsedSections.value.has(id)
}

// --- Scroll tracking ---

const contentRef = ref<HTMLDivElement | null>(null)
const activeId = ref<string>('')
const isScrolling = ref(false)
let scrollTimer: ReturnType<typeof setTimeout> | null = null

// Collect all heading element positions on mount and after render
const headingElements = computed<{id: string; top: number}[]>(() => {
    if (!contentRef.value) return []
    const items: {id: string; top: number}[] = []
    const root = contentRef.value
    // Find all h2 and h3 elements
    const allHeadings = root.querySelectorAll<HTMLElement>('h2, h3')
    allHeadings.forEach((el) => {
        const id = el.id
        if (id) {
            items.push({id, top: el.offsetTop})
        }
    })
    return items
})

const onScroll = () => {
    if (!contentRef.value || isScrolling.value) return
    const scrollTop = contentRef.value.scrollTop
    const headings = headingElements.value

    // Find the last heading that is above or at current scroll position
    let current = ''
    for (let i = headings.length - 1; i >= 0; i--) {
        if (headings[i].top <= scrollTop + 60) {
            current = headings[i].id
            break
        }
    }
    if (current && current !== activeId.value) {
        activeId.value = current
    }
}

const scrollTo = (id: string) => {
    if (!contentRef.value) return
    const el = contentRef.value.querySelector<HTMLElement>(`#${CSS.escape(id)}`)
    if (el) {
        isScrolling.value = true
        activeId.value = id
        el.scrollIntoView({behavior: 'smooth', block: 'start'})
        if (scrollTimer) clearTimeout(scrollTimer)
        scrollTimer = setTimeout(() => {
            isScrolling.value = false
        }, 500)
    }
}

const isActive = (id: string): boolean => {
    return activeId.value === id
}

const isChildActive = (item: TocItem): boolean => {
    if (activeId.value === item.id) return true
    return item.children.some((c) => activeId.value === c.id)
}

onMounted(() => {
    nextTick(() => {
        // Set initial active ID to first heading
        if (toc.value.length > 0) {
            activeId.value = toc.value[0].id
        }
    })
})

onUnmounted(() => {
    if (scrollTimer) clearTimeout(scrollTimer)
})
</script>

<template>
    <div class="flex h-full bg-white dark:bg-gray-900">
        <!-- Left sidebar: TOC navigation -->
        <div
            class="w-48 shrink-0 overflow-y-auto border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800"
        >
            <div class="py-2">
                <div
                    v-for="item in toc"
                    :key="item.id"
                    class="border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                >
                    <!-- H2 level -->
                    <div
                        class="flex items-center gap-1 px-3 py-2 cursor-pointer text-xs font-medium select-none transition-colors"
                        :class="
                            isChildActive(item)
                                ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                        "
                        @click="scrollTo(item.id)"
                    >
                        <!-- Collapse toggle -->
                        <button
                            class="shrink-0 w-4 h-4 flex items-center justify-center rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                            @click.stop="toggleCollapse(item.id)"
                        >
                            <svg
                                class="w-3 h-3 transition-transform"
                                :class="isCollapsed(item.id) ? '-rotate-90' : ''"
                                viewBox="0 0 12 12"
                                fill="none"
                            >
                                <path
                                    d="M4 2l4 4-4 4"
                                    stroke="currentColor"
                                    stroke-width="1.5"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                />
                            </svg>
                        </button>
                        <span class="truncate">{{ item.text }}</span>
                    </div>
                    <!-- H3 children -->
                    <div v-if="!isCollapsed(item.id) && item.children.length > 0">
                        <div
                            v-for="child in item.children"
                            :key="child.id"
                            class="flex items-center gap-1 pl-7 pr-3 py-1.5 cursor-pointer text-xs select-none transition-colors"
                            :class="
                                isActive(child.id)
                                    ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 font-medium'
                                    : 'text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                            "
                            @click="scrollTo(child.id)"
                        >
                            <span
                                class="w-1 h-1 rounded-full shrink-0 bg-gray-300 dark:bg-gray-600"
                                :class="isActive(child.id) ? '!bg-blue-500 dark:!bg-blue-400' : ''"
                            />
                            <span class="truncate">{{ child.text }}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Right side: rendered markdown content -->
        <div
            ref="contentRef"
            class="flex-1 overflow-y-auto px-4 py-4 text-sm leading-relaxed text-gray-700 dark:text-gray-300 markdown-body"
            @scroll="onScroll"
            v-html="htmlContent"
        />
    </div>
</template>

<style scoped>
.markdown-body :deep(h1) {
    @apply text-lg font-bold mb-4 mt-1 text-gray-900 dark:text-gray-100 pb-2 border-b border-gray-200 dark:border-gray-700;
}
.markdown-body :deep(h2) {
    @apply text-base font-bold mb-3 mt-6 text-gray-900 dark:text-gray-100 pb-1.5 border-b border-gray-100 dark:border-gray-800;
}
.markdown-body :deep(h3) {
    @apply text-sm font-bold mb-2 mt-5 text-gray-800 dark:text-gray-200;
}
.markdown-body :deep(h4) {
    @apply text-xs font-bold mb-1 mt-3 text-gray-700 dark:text-gray-300;
}
.markdown-body :deep(p) {
    @apply mb-2 text-xs;
}
.markdown-body :deep(code) {
    @apply bg-gray-100 dark:bg-gray-700 px-1 rounded text-xs;
}
.markdown-body :deep(pre) {
    @apply bg-gray-900 text-green-400 p-3 rounded text-xs leading-relaxed overflow-x-auto mb-3;
}
.markdown-body :deep(pre code) {
    @apply bg-transparent p-0;
}
.markdown-body :deep(table) {
    @apply w-full mb-3 border-collapse text-xs;
}
.markdown-body :deep(th) {
    @apply border border-gray-300 dark:border-gray-600 px-2 py-1.5 bg-gray-50 dark:bg-gray-800 text-left font-semibold;
}
.markdown-body :deep(td) {
    @apply border border-gray-300 dark:border-gray-600 px-2 py-1.5;
}
.markdown-body :deep(ul) {
    @apply list-disc pl-4 mb-2 text-xs;
}
.markdown-body :deep(ol) {
    @apply list-decimal pl-4 mb-2 text-xs;
}
.markdown-body :deep(li) {
    @apply mb-1;
}
.markdown-body :deep(hr) {
    @apply border-gray-300 dark:border-gray-600 my-4;
}
.markdown-body :deep(a) {
    @apply text-blue-600 dark:text-blue-400 hover:underline;
}
.markdown-body :deep(blockquote) {
    @apply border-l-4 border-gray-300 dark:border-gray-600 pl-3 py-1 mb-3 text-gray-500 dark:text-gray-400 italic text-xs;
}
.markdown-body :deep(strong) {
    @apply font-bold text-gray-900 dark:text-gray-100;
}
</style>
