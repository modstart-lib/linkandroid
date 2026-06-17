<script setup lang="ts">
import {DeviceRecord} from '../../types/Device'

const props = defineProps<{
    device: DeviceRecord
}>()

const emit = defineEmits<{
    (e: 'camera'): void
}>()

const doOpenCamera = () => {
    emit('camera')
}
</script>

<template>
    <a-doption @click="doOpenCamera">
        {{ $t('device.openCamera') }}
    </a-doption>
</template>
