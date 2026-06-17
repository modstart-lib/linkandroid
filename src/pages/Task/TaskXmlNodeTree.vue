<script setup lang="ts">
import {computed, ref} from 'vue'
import type {TreeNodeData} from '@arco-design/web-vue/es/tree/interface'

defineOptions({name: 'TaskXmlNodeTree'})

export interface TaskXmlNode {
    id: string
    tag: string
    text: string
    resourceId: string
    contentDesc: string
    className: string
    bounds: string
    clickable?: string
    children: TaskXmlNode[]
}

interface TreeData extends TreeNodeData {
    raw: TaskXmlNode
    children?: TreeData[]
}

const props = defineProps<{
    nodes: TaskXmlNode[]
    selectedId: string
    hoveredId?: string
    searchText?: string
}>()

const emit = defineEmits<{
    select: [node: TaskXmlNode]
    hover: [node: TaskXmlNode]
    unhover: []
}>()

const treeRef = ref<any>(null)

const getShortClassName = (className: string) => {
    const parts = className.split('.')
    return parts[parts.length - 1] || className
}

const isClickable = (node: TaskXmlNode): boolean => {
    return node.clickable === 'true'
}

const getNodeMeta = (node: TaskXmlNode): string => {
    const parts: string[] = []
    if (node.text) parts.push(node.text)
    if (node.contentDesc) parts.push(node.contentDesc)
    if (node.resourceId) {
        const shortId = node.resourceId.split('/').pop() || node.resourceId
        parts.push(shortId)
    }
    return parts.join(' · ') || ''
}

const toTreeData = (nodeList: TaskXmlNode[]): TreeData[] => {
    return nodeList.map((node) => ({
        key: node.id,
        title: getShortClassName(node.className),
        raw: node,
        isLeaf: node.children.length === 0,
        children: node.children.length > 0 ? toTreeData(node.children) : undefined,
    }))
}

const treeData = computed(() => toTreeData(props.nodes))

const selectedKeys = computed(() => (props.selectedId ? [props.selectedId] : []))

// filterTreeNode must return a new function when searchText changes
const filterTreeNode = computed(() => {
    const q = props.searchText?.trim().toLowerCase()
    if (!q) return undefined
    return (node: TreeNodeData) => {
        const raw = (node as TreeData).raw
        if (!raw) return false
        return (
            raw.className.toLowerCase().includes(q) ||
            raw.text.toLowerCase().includes(q) ||
            raw.contentDesc.toLowerCase().includes(q) ||
            raw.resourceId.toLowerCase().includes(q) ||
            raw.id.includes(q)
        )
    }
})

const onSelect = (
    selectedKeys: (string | number)[],
    data: {selected?: boolean; selectedNodes?: TreeNodeData[]; node?: TreeNodeData; e?: Event},
) => {
    if (data.node) {
        const raw = (data.node as TreeData).raw
        if (raw) {
            emit('select', raw)
        }
    }
}

const scrollToNode = (nodeId: string) => {
    if (treeRef.value && typeof treeRef.value.scrollIntoView === 'function') {
        treeRef.value.scrollIntoView(nodeId)
    }
}

defineExpose({scrollToNode})
</script>

<template>
    <div @mouseleave="emit('unhover')">
        <a-tree
            ref="treeRef"
            :data="treeData as TreeNodeData[]"
            :selectedKeys="selectedKeys"
            :filterTreeNode="filterTreeNode"
            showLine
            blockNode
            defaultExpandAll
            @select="onSelect"
        >
            <template #title="{title, raw}">
                <span
                    class="block"
                    :class="raw?.id === hoveredId ? 'bg-teal-100 dark:bg-teal-900/30 -mx-1 px-1 rounded' : ''"
                    @mouseenter="raw && emit('hover', raw)"
                >
                    <span class="font-medium text-xs">
                        <i-lucide-mouse-pointer-click
                            v-if="raw && isClickable(raw)"
                            class="inline-block w-3 h-3 mr-0.5 text-orange-500 align-text-bottom"
                        />
                        {{ title }}
                    </span>
                    <span v-if="raw && getNodeMeta(raw)" class="ml-1 text-[11px] text-gray-400 dark:text-gray-500">
                        {{ getNodeMeta(raw) }}
                    </span>
                </span>
            </template>
        </a-tree>
    </div>
</template>

<style scoped>
:deep(.arco-tree-node-indent-block) {
    width: 10px !important;
    min-width: 10px !important;
}
:deep(.arco-tree-node-expand-icon) {
    margin-right: 0 !important;
}
:deep(.arco-tree-node-content-wrapper) {
    padding-left: 0 !important;
}
</style>
