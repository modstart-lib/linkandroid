<script setup lang="ts">
import {computed} from 'vue'
import {useDeviceStore} from '../../store/modules/device'
import {DeviceRecord, EnumDeviceStatus} from '../../types/Device'

const props = defineProps<{
    device: DeviceRecord
}>()

const emit = defineEmits<{
    (e: 'mirror-app'): void
}>()

const deviceStore = useDeviceStore()

const mirroringCount = computed(() => {
    if (props.device.status !== EnumDeviceStatus.CONNECTED) return 0
    return deviceStore.runtimeOf(props.device).appMirrors?.length || 0
})

const doOpen = () => {
    emit('mirror-app')
}
</script>

<template>
    <a-doption @click="doOpen">
        <template #icon>
            <i-lucide-app-window />
        </template>
        {{ $t('device.mirrorApp') }}{{ mirroringCount ? ` (${mirroringCount})` : '' }}
    </a-doption>
</template>
