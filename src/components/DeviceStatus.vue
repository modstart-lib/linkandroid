<script setup lang="ts">
import {EnumDeviceStatus} from "../types/Device";

interface Props {
    status: EnumDeviceStatus | null
}

const props = defineProps<Props>()
</script>

<template>
    <div class="text-white px-2 py-1 rounded-full text-sm inline-flex items-center"
         :class="{'bg-gray-400': props.status===EnumDeviceStatus.WAIT_CONNECTING, 'bg-green-500': props.status===EnumDeviceStatus.CONNECTED, 'bg-red-500': props.status===EnumDeviceStatus.DISCONNECTED}">
        <div class="w-2 h-2 rounded-full bg-white mr-2"></div>
        <div v-if="props.status===EnumDeviceStatus.WAIT_CONNECTING">
            {{ $t('连接中') }}
        </div>
        <div v-else-if="props.status===EnumDeviceStatus.CONNECTED">
            {{ $t('已连接') }}
        </div>
        <div v-else-if="props.status===EnumDeviceStatus.DISCONNECTED">
            {{ $t('已断开') }}
        </div>
    </div>
</template>

