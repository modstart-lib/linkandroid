<script setup lang="ts">
interface LogItem {
    num: number;
    text: string;
}

const props = withDefaults(
    defineProps<{
        logs: LogItem[];
        height?: string;
    }>(),
    {
        logs: [] as any,
        height: "100%",
    }
);
</script>

<template>
    <div :style="{height: props.height}" ref="logContainer" class="bg-black p-3 overflow-auto">
        <div v-if="!logs.length" class="text-center text-white py-10">
            <div>
                <i class="iconfont icon-empty-box text-4xl"></i>
            </div>
            <div class="text-xs mt-3">
                {{ $t("empty.noLog") }}
            </div>
        </div>
        <div v-for="log in logs" class="text-white text-sm font-mono leading-6">
            <div class="inline-block text-right min-w-10 pr-3 text-gray-400">{{ log.num }}</div>
            <div class="inline-block">{{ log.text }}</div>
        </div>
    </div>
</template>

<style scoped></style>
