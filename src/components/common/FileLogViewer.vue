<script setup lang="ts">
import LogViewer from "./LogViewer.vue";
import {onBeforeUnmount, onMounted, ref} from "vue";

const props = withDefaults(defineProps<{
    file: string,
    maxLines?: number,
    height?: string
}>(), {
    file: '',
    maxLines: 1000,
    height: '100%',
})

interface LogItem {
    num: number,
    text: string
}

const logs = ref<LogItem[]>([])
let controller: any = null
onMounted(async () => {
    controller = await window.$mapi.file.watchText(props.file, (data: {}) => {
        logs.value.push(data as LogItem)
        while (logs.value.length > props.maxLines) {
            logs.value.shift()
        }
    })
})
onBeforeUnmount(() => {
    if (controller) {
        controller.stop()
    }
})
</script>

<template>
    <div>
        <LogViewer :height="props.height" :logs="logs"/>
    </div>
</template>

<style scoped>

</style>
