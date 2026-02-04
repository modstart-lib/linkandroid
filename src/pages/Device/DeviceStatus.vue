<script setup lang="ts">
import {EnumDeviceStatus} from "../../types/Device";

interface Props {
    status: EnumDeviceStatus | null;
}

const props = defineProps<Props>();
</script>

<template>
    <div
        class="text-white px-1 py-1 rounded-full text-xs inline-flex items-center"
        :class="{
            'bg-gray-400': props.status === EnumDeviceStatus.WAIT_CONNECTING,
            'bg-green-500': props.status === EnumDeviceStatus.CONNECTED,
            'bg-red-500': props.status === EnumDeviceStatus.DISCONNECTED,
        }"
    >
        <div class="w-2 h-2 rounded-full bg-white mr-1"></div>
        <div v-if="props.status === EnumDeviceStatus.WAIT_CONNECTING">
            {{ $t("device.statusConnecting") }}
        </div>
        <div v-else-if="props.status === EnumDeviceStatus.CONNECTED">
            {{ $t("device.statusConnected") }}
        </div>
        <div v-else-if="props.status === EnumDeviceStatus.DISCONNECTED">
            {{ $t("device.statusDisconnected") }}
        </div>
    </div>
</template>
