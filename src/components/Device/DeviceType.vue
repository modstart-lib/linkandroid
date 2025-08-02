<script setup lang="ts">
import {EnumDeviceType} from "../../types/Device";
import {computed} from "vue";
import {t} from "../../lang";

interface Props {
    type: EnumDeviceType | null;
}

const tipText = computed(() => {
    return props.type === EnumDeviceType.WIFI ? t("网络连接") : t("USB连接");
});

const props = defineProps<Props>();
</script>

<template>
    <a-tooltip :content="tipText">
        <div class="h-6 w-6 text-center text-gray-500 leading-6 rounded text-sm inline-block mr-1">
            <i v-if="props.type === EnumDeviceType.USB" class="iconfont icon-usb"></i>
            <i v-else-if="props.type === EnumDeviceType.WIFI" class="iconfont icon-network"></i>
        </div>
    </a-tooltip>
</template>
