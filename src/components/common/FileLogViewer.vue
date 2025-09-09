<script setup lang="ts">
import LogViewer from "./LogViewer.vue";
import {onBeforeUnmount, onMounted, ref} from "vue";

const props = withDefaults(
    defineProps<{
        file: string;
        maxLines?: number;
        height?: string;
        autoScroll?: boolean;
        isDataPath?: boolean;
    }>(),
    {
        file: "",
        maxLines: 1000,
        height: "100%",
        autoScroll: true,
        isDataPath: true,
    }
);

interface LogItem {
    num: number;
    text: string;
}

const logs = ref<LogItem[]>([]);
let controller: any = null;
onMounted(async () => {
    controller = await window.$mapi.file.watchText(
        props.file,
        (data: {}) => {
            logs.value.push(data as LogItem);
            while (logs.value.length > props.maxLines) {
                logs.value.shift();
            }
        },
        {
            isDataPath: props.isDataPath,
            limit: props.maxLines,
        }
    );
});
onBeforeUnmount(() => {
    if (controller) {
        controller.stop();
    }
});
</script>

<template>
    <div :style="{height:props.height}">
        <LogViewer :height="props.height" :logs="logs" :auto-scroll="autoScroll"/>
    </div>
</template>

<style scoped></style>
