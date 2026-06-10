<script setup lang="ts">
import {DeviceRecord} from '../../types/Device'
import DeviceRecordDialog from './DeviceRecordDialog.vue'
import {ref} from 'vue'

const recordDialog = ref<InstanceType<typeof DeviceRecordDialog>>()
const props = defineProps<{
    device: DeviceRecord
}>()
</script>

<template>
    <a-tooltip :content="$t('device.record')">
        <a-button class="ml-1" @click="recordDialog?.show(props.device)">
            <template #icon>
                <i-mdi-video class="text-gray-400" />
            </template>
        </a-button>
    </a-tooltip>
    <DeviceRecordDialog ref="recordDialog" />
</template>

<style scoped></style>
