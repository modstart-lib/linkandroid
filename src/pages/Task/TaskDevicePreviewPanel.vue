<script setup lang="ts">
import {computed, nextTick, ref} from 'vue'
import {t} from '../../lang'
import {Dialog} from '../../lib/dialog'
import {mapError} from '../../lib/error'
import {collectDeviceScreenshotByLa, collectDeviceXmlByLa} from './TaskRuntime'
import TaskXmlNodeTree, {TaskXmlNode} from './TaskXmlNodeTree.vue'

const props = defineProps<{
    selectedDeviceId: string
}>()

const emit = defineEmits<{
    insertLocator: [code: string]
}>()

interface BoundsRect {
    x1: number
    y1: number
    x2: number
    y2: number
}

const loading = ref(false)
const screenshot = ref('')
const xmlText = ref('')
const nodes = ref<TaskXmlNode[]>([])
const selectedNode = ref<TaskXmlNode | null>(null)
const hoveredNode = ref<TaskXmlNode | null>(null)
const searchText = ref('')
const xmlTreeComponentRef = ref<any>(null)

const zoomLevel = ref(1)
const zoomMin = 0.25
const zoomMax = 2
const zoomStep = 0.25

const zoomIn = () => {
    zoomLevel.value = Math.min(zoomMax, +(zoomLevel.value + zoomStep).toFixed(2))
}

const zoomOut = () => {
    zoomLevel.value = Math.max(zoomMin, +(zoomLevel.value - zoomStep).toFixed(2))
}

const parseBounds = (bounds: string): BoundsRect | null => {
    const match = bounds.match(/\[(\d+),(\d+)]\[(\d+),(\d+)]/)
    if (!match) return null
    return {
        x1: Number(match[1]),
        y1: Number(match[2]),
        x2: Number(match[3]),
        y2: Number(match[4]),
    }
}

const walkNodes = (nodeList: TaskXmlNode[], each: (node: TaskXmlNode) => void) => {
    for (const node of nodeList) {
        each(node)
        walkNodes(node.children, each)
    }
}

const screenBounds = computed(() => {
    let width = 0
    let height = 0
    walkNodes(nodes.value, (node) => {
        const rect = parseBounds(node.bounds)
        if (!rect) return
        width = Math.max(width, rect.x2)
        height = Math.max(height, rect.y2)
    })
    return {
        width: width || 1080,
        height: height || 1920,
    }
})

const flatBoundNodes = computed(() => {
    const items: Array<{node: TaskXmlNode; rect: BoundsRect}> = []
    walkNodes(nodes.value, (node) => {
        const rect = parseBounds(node.bounds)
        if (!rect) return
        if (rect.x2 <= rect.x1 || rect.y2 <= rect.y1) return
        if (!node.text && !node.contentDesc && !node.resourceId && !node.className) return
        items.push({node, rect})
    })
    return items
})

const locatorText = computed(() => {
    const node = selectedNode.value
    if (!node) return ''
    return [
        node.resourceId ? `resourceId=${node.resourceId}` : '',
        node.text ? `text=${node.text}` : '',
        node.contentDesc ? `contentDesc=${node.contentDesc}` : '',
        node.className ? `className=${node.className}` : '',
        node.bounds ? `bounds=${node.bounds}` : '',
    ]
        .filter(Boolean)
        .join('\n')
})

const selectedLocatorCode = computed(() => {
    const node = selectedNode.value
    if (!node) return ''
    const rows = [
        node.resourceId ? `    'resource_id': '${pythonString(node.resourceId)}',` : '',
        node.text ? `    'text': '${pythonString(node.text)}',` : '',
        node.contentDesc ? `    'content_desc': '${pythonString(node.contentDesc)}',` : '',
        node.className ? `    'class_name': '${pythonString(node.className)}',` : '',
        node.bounds ? `    'bounds': '${pythonString(node.bounds)}',` : '',
    ].filter(Boolean)
    return [t('device.preview.locatorComment'), 'locator = {', ...rows, '}'].join('\n')
})

// All node attributes for the detail panel (excluding children)
const selectedNodePath = computed(() => {
    const node = selectedNode.value
    if (!node) return ''
    const path = findNodePath(nodes.value, node.id)
    return path.map((n) => getShortClassName(n.className)).join(' / ')
})

const nodeDetailRows = computed(() => {
    const node = selectedNode.value
    if (!node) return []
    const rows: Array<{label: string; value: string}> = [
        {label: 'path', value: selectedNodePath.value || '-'},
        {label: 'class', value: node.className || '-'},
        {label: 'tag', value: node.tag || '-'},
        {label: 'id', value: node.id || '-'},
        {label: 'text', value: node.text || '-'},
        {label: 'content-desc', value: node.contentDesc || '-'},
        {label: 'resource-id', value: node.resourceId || '-'},
        {label: 'bounds', value: node.bounds || '-'},
    ]
    return rows
})

const pythonString = (value: string) => {
    return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

const buildNode = (el: Element, path: string): TaskXmlNode => {
    const children = Array.from(el.children).map((child, index) => buildNode(child, `${path}.${index}`))
    return {
        id: path,
        tag: el.tagName,
        text: el.getAttribute('text') || '',
        resourceId: el.getAttribute('resource-id') || '',
        contentDesc: el.getAttribute('content-desc') || '',
        className: el.getAttribute('class') || '',
        bounds: el.getAttribute('bounds') || '',
        clickable: el.getAttribute('clickable') || '',
        children,
    }
}

const getShortClassName = (className: string) => {
    const parts = className.split('.')
    return parts[parts.length - 1] || className
}

const findNodePath = (nodeList: TaskXmlNode[], targetId: string): TaskXmlNode[] => {
    for (const node of nodeList) {
        if (node.id === targetId) return [node]
        if (node.children.length > 0) {
            const found = findNodePath(node.children, targetId)
            if (found.length > 0) return [node, ...found]
        }
    }
    return []
}

const currentPath = computed(() => {
    const target = hoveredNode.value || selectedNode.value
    if (!target) return []
    return findNodePath(nodes.value, target.id)
})

const parseXml = (xml: string) => {
    const documentXml = new DOMParser().parseFromString(xml, 'text/xml')
    if (documentXml.querySelector('parsererror')) {
        throw new Error(t('device.preview.xmlParseError'))
    }
    return Array.from(documentXml.children).map((child, index) => buildNode(child, `${index}`))
}

const doPreview = async () => {
    if (!props.selectedDeviceId) {
        Dialog.tipError(t('hint.selectDeviceFirst'))
        return
    }
    loading.value = true
    try {
        const xml = await collectDeviceXmlByLa(props.selectedDeviceId)
        xmlText.value = xml
        nodes.value = parseXml(xml)
        selectedNode.value = null
        try {
            const image = await collectDeviceScreenshotByLa(props.selectedDeviceId)
            screenshot.value = image ? `data:image/png;base64,${image}` : ''
            Dialog.tipSuccess(t('device.preview.screenSynced'))
        } catch {
            screenshot.value = ''
            Dialog.tipSuccess(t('device.preview.xmlSyncedNoScreenshot'))
        }
    } catch (e) {
        Dialog.tipError(mapError(e))
    } finally {
        loading.value = false
    }
}

const doSelectNode = (node: TaskXmlNode) => {
    selectedNode.value = node
}

const onPhoneOverlayClick = (node: TaskXmlNode) => {
    selectedNode.value = node
    nextTick(() => {
        xmlTreeComponentRef.value?.scrollToNode(node.id)
    })
}

const onPhoneOverlayMouseEnter = (node: TaskXmlNode) => {
    hoveredNode.value = node
    nextTick(() => {
        xmlTreeComponentRef.value?.scrollToNode(node.id)
    })
}

const onPhoneOverlayMouseLeave = () => {
    hoveredNode.value = null
}

const doCopyLocator = async () => {
    if (!locatorText.value) return
    await window.$mapi.app.setClipboardText(locatorText.value)
    Dialog.tipSuccess(t('device.preview.locatorCopied'))
}

const doCopyAttribute = async (value: string) => {
    if (!value || value === '-') return
    await window.$mapi.app.setClipboardText(value)
    Dialog.tipSuccess(t('device.preview.locatorCopied'))
}

const doInsertLocator = () => {
    if (!selectedLocatorCode.value) return
    emit('insertLocator', selectedLocatorCode.value)
    Dialog.tipSuccess(t('device.preview.locatorInserted'))
}

const testSelectFirstLocator = () => {
    const first = flatBoundNodes.value[0]?.node
    if (first) {
        doSelectNode(first)
    }
    return locatorText.value
}

defineExpose({
    doPreview,
    loading,
    testSelectFirstLocator,
    getSelectedLocator: () => locatorText.value,
    getXmlLength: () => xmlText.value.length,
})
</script>

<template>
    <div class="flex flex-col h-full bg-gray-50 dark:bg-gray-900 relative">
        <div class="flex-1 min-h-0 flex overflow-hidden">
            <!-- Left: Screenshot -->
            <div class="w-1/2 min-w-0 overflow-auto p-2 border-r border-gray-200 dark:border-gray-700">
                <div
                    v-if="!screenshot"
                    class="h-full min-h-[360px] flex flex-col items-center justify-center text-center text-gray-400"
                >
                    <i-lucide-smartphone class="text-5xl mb-3 opacity-30" />
                    <div class="text-sm mb-3">
                        {{
                            xmlText ? $t('device.preview.screenshotNotAvailable') : $t('device.preview.clickToRefresh')
                        }}
                    </div>
                    <a-button type="primary" :loading="loading" @click="doPreview">
                        <template #icon><i-lucide-refresh-cw /></template>
                        {{ $t('common.refresh') }}
                    </a-button>
                </div>

                <div v-if="screenshot" class="flex flex-col items-center gap-2 pt-2">
                    <!-- Zoom & refresh toolbar -->
                    <div
                        class="flex items-center gap-1 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-2 py-1 shadow-sm"
                    >
                        <a-button size="mini" @click="zoomOut" :disabled="zoomLevel <= zoomMin">
                            <template #icon><i-mdi-magnify-minus /></template>
                        </a-button>
                        <span class="text-xs font-mono w-10 text-center select-none"
                            >{{ Math.round(zoomLevel * 100) }}%</span
                        >
                        <a-button size="mini" @click="zoomIn" :disabled="zoomLevel >= zoomMax">
                            <template #icon><i-mdi-magnify-plus /></template>
                        </a-button>
                        <div class="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-1" />
                        <a-button size="mini" :loading="loading" @click="doPreview">
                            <template #icon><i-lucide-refresh-cw /></template>
                            {{ $t('common.refresh') }}
                        </a-button>
                    </div>

                    <!-- Zoomable phone frame -->
                    <div
                        class="mx-auto w-full max-w-[260px]"
                        :style="{transform: `scale(${zoomLevel})`, transformOrigin: 'top center'}"
                    >
                        <div class="relative rounded-[2rem] bg-gray-900 p-3 shadow">
                            <div
                                class="relative overflow-hidden rounded-[1.35rem] bg-black"
                                :style="{aspectRatio: `${screenBounds.width} / ${screenBounds.height}`}"
                            >
                                <img
                                    :src="screenshot"
                                    class="absolute inset-0 w-full h-full object-contain"
                                    :alt="$t('device.preview.screenshotAlt')"
                                />
                                <div
                                    v-for="item in flatBoundNodes"
                                    :key="item.node.id"
                                    class="absolute cursor-pointer border transition-colors"
                                    :class="
                                        selectedNode?.id === item.node.id
                                            ? 'border-blue-500 bg-blue-500/20'
                                            : hoveredNode?.id === item.node.id
                                              ? 'border-teal-400 bg-teal-400/20'
                                              : 'border-transparent hover:border-blue-400 hover:bg-blue-400/10'
                                    "
                                    :style="{
                                        left: `${(item.rect.x1 / screenBounds.width) * 100}%`,
                                        top: `${(item.rect.y1 / screenBounds.height) * 100}%`,
                                        width: `${((item.rect.x2 - item.rect.x1) / screenBounds.width) * 100}%`,
                                        height: `${((item.rect.y2 - item.rect.y1) / screenBounds.height) * 100}%`,
                                    }"
                                    :title="item.node.text || item.node.contentDesc || item.node.resourceId"
                                    @click.stop="onPhoneOverlayClick(item.node)"
                                    @mouseenter="onPhoneOverlayMouseEnter(item.node)"
                                    @mouseleave="onPhoneOverlayMouseLeave()"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Right: XML tree -->
            <div class="w-1/2 min-w-0 flex flex-col">
                <div
                    v-if="nodes.length === 0"
                    class="flex-1 flex items-center justify-center text-center text-gray-400"
                >
                    <div class="text-sm">{{ $t('device.preview.noXml') }}</div>
                </div>
                <div v-if="nodes.length > 0" class="flex-1 min-h-0 flex flex-col overflow-hidden">
                    <!-- Path breadcrumb -->
                    <div
                        v-if="currentPath.length > 0"
                        class="flex items-center flex-wrap gap-x-1 gap-y-0 px-3 py-1.5 text-xs border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50"
                    >
                        <i-lucide-navigation class="w-3 h-3 text-gray-400 shrink-0" />
                        <template v-for="(node, index) in currentPath" :key="node.id">
                            <span v-if="index > 0" class="text-gray-300 dark:text-gray-600">/</span>
                            <span
                                class="truncate max-w-[130px]"
                                :class="
                                    index === currentPath.length - 1
                                        ? 'text-blue-600 dark:text-blue-400 font-semibold'
                                        : 'text-gray-500 dark:text-gray-400'
                                "
                            >
                                {{ getShortClassName(node.className) }}
                            </span>
                        </template>
                    </div>
                    <!-- Search bar -->
                    <div class="flex items-center gap-1 px-2 pt-1.5 pb-1">
                        <a-input-search
                            v-model="searchText"
                            :placeholder="$t('common.search') + '...'"
                            size="mini"
                            allow-clear
                            class="flex-1"
                        />
                    </div>
                    <!-- Tree -->
                    <div class="flex-1 min-h-0 overflow-auto px-1 pb-1">
                        <div
                            class="min-w-full inline-block bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded"
                        >
                            <div class="py-0.5 min-w-max">
                                <TaskXmlNodeTree
                                    ref="xmlTreeComponentRef"
                                    :nodes="nodes"
                                    :selected-id="selectedNode?.id || ''"
                                    :hovered-id="hoveredNode?.id || ''"
                                    :search-text="searchText"
                                    @select="doSelectNode"
                                    @hover="
                                        (node: TaskXmlNode) => {
                                            hoveredNode = node
                                        }
                                    "
                                    @unhover="
                                        () => {
                                            hoveredNode = null
                                        }
                                    "
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Floating detail panel (shown when a node is selected) -->
        <div
            v-if="selectedNode"
            class="absolute bottom-2 right-2 left-2 z-10 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-[280px] overflow-hidden flex flex-col"
        >
            <!-- Header with title bar -->
            <div class="flex items-center gap-2 px-3 py-2 border-b border-gray-100 dark:border-gray-700 shrink-0">
                <i-lucide-tag class="text-blue-500 shrink-0" />
                <span class="text-xs font-medium text-gray-500 dark:text-gray-400 truncate">
                    {{ $t('device.preview.selectedLocator') }}
                </span>
                <div class="flex-1 min-w-0" />
                <a-button size="mini" @click="doCopyLocator">
                    <template #icon><i-lucide-copy /></template>
                    {{ $t('common.copy') }}
                </a-button>
                <a-button size="mini" type="primary" @click="doInsertLocator">
                    <template #icon><i-lucide-plus /></template>
                    {{ $t('device.preview.insertToTask') }}
                </a-button>
                <a-button size="mini" @click="selectedNode = null" type="text" :aria-label="$t('common.close')">
                    <template #icon><i-lucide-x /></template>
                </a-button>
            </div>

            <!-- Scrollable content: attributes + locator code -->
            <div class="flex-1 overflow-auto px-3 py-2 space-y-2 text-xs">
                <!-- Attribute detail grid -->
                <div class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                    <template v-for="row in nodeDetailRows" :key="row.label">
                        <span
                            class="text-gray-400 font-medium shrink-0 cursor-pointer hover:text-blue-500 transition-colors"
                            :title="$t('common.copy')"
                            @click="doCopyAttribute(row.value)"
                            >{{ row.label }}</span
                        >
                        <span
                            class="text-gray-700 dark:text-gray-300 break-all font-mono cursor-pointer hover:text-blue-500 transition-colors"
                            :title="$t('common.copy')"
                            @click="doCopyAttribute(row.value)"
                            >{{ row.value }}</span
                        >
                    </template>
                </div>

                <!-- Locator code -->
                <div v-if="selectedLocatorCode">
                    <div class="text-gray-400 font-medium mb-1">
                        {{ $t('device.preview.locatorComment').replace('# ', '') }}
                    </div>
                    <pre
                        class="m-0 whitespace-pre-wrap break-all text-[11px] leading-relaxed text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/50 rounded p-1.5"
                        >{{ selectedLocatorCode }}</pre
                    >
                </div>
            </div>
        </div>
    </div>
</template>
