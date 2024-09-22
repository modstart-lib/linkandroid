<script setup lang="ts">
import {DeviceRecord} from "../../types/Device";
import DeviceRecordDialog from "./DeviceRecordDialog.vue";
import {ref} from "vue";

const recordDialog = ref<InstanceType<typeof DeviceRecordDialog>>()
const props = defineProps<{
    device: DeviceRecord
}>()
</script>

<template>
    <a-tooltip :content="$t('录制屏幕')">
        <a-button class="ml-1" @click="recordDialog?.show(props.device)">
            <template #icon>
                <i class="iconfont icon-video text-gray-400"></i>
            </template>
        </a-button>
    </a-tooltip>
    <DeviceRecordDialog ref="recordDialog"/>
</template>

<style scoped>

</style>
