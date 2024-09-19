<script setup lang="ts">
import {EnumDeviceStatus} from "../types/Device";

interface Props {
    status: EnumDeviceStatus | null
}

const props = defineProps<Props>()
</script>

<template>
    <div class="inline-block text-gray-400 text-sm">
        <div v-if="props.status===EnumDeviceStatus.WAIT_CONNECTING">
            <div class="inline-block w-2 h-2 rounded-full bg-gray-500 mr-1"></div>
            {{ $t('等待连接') }}
        </div>
        <div v-else-if="props.status===EnumDeviceStatus.CONNECTED">
            <div class="inline-block w-2 h-2 rounded-full bg-green-500 mr-1"></div>
            {{ $t('已连接') }}
        </div>
        <div v-else-if="props.status===EnumDeviceStatus.DISCONNECTED">
            <div class="inline-block w-2 h-2 rounded-full bg-red-500 mr-1"></div>
            {{ $t('已断开') }}
        </div>
    </div>
</template>

