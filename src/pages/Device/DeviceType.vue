<script setup lang="ts">
import {EnumDeviceType} from '../../types/Device'
import {computed} from 'vue'
import {t} from '../../lang'

interface Props {
    type: EnumDeviceType | null
}

const tipText = computed(() => {
    return props.type === EnumDeviceType.WIFI ? t('device.typeWifi') : t('device.typeUsb')
})

const props = defineProps<Props>()
</script>

<template>
    <a-tooltip :content="tipText">
        <div class="h-6 w-6 flex items-center justify-center text-gray-500 rounded text-sm">
            <i-mdi-usb v-if="props.type === EnumDeviceType.USB" />
            <i-mdi-wifi v-else-if="props.type === EnumDeviceType.WIFI" />
        </div>
    </a-tooltip>
</template>
