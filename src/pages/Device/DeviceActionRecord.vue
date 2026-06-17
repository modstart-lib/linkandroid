<script setup lang="ts">
import {DeviceRecord} from '../../types/Device'
import DeviceRecordDialog from './DeviceRecordDialog.vue'
import {onBeforeUnmount, onMounted, ref} from 'vue'
import {testActionSet, testActionUnset} from '../../utils/test'

const recordDialog = ref<InstanceType<typeof DeviceRecordDialog>>()
const props = defineProps<{
    device: DeviceRecord
}>()

onMounted(() => {
    testActionSet('device.record.show', () => recordDialog.value?.show(props.device))
})

onBeforeUnmount(() => {
    testActionUnset('device.record.show')
})
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
