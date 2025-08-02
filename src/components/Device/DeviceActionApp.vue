<script setup lang="ts">
import {DeviceRecord} from "../../types/Device";
import DeviceAppManagerDialog from "./DeviceAppManagerDialog.vue";
import DeviceAppInstallDialog from "./DeviceAppInstallDialog.vue";
import {ref} from "vue";

const appManagerDialog = ref<InstanceType<typeof DeviceAppManagerDialog> | null>(null);
const appInstallDialog = ref<InstanceType<typeof DeviceAppInstallDialog> | null>(null);
const props = defineProps<{
    device: DeviceRecord;
}>();
</script>

<template>
    <a-tooltip :content="$t('应用管理')">
        <a-dropdown trigger="hover">
            <a-button class="ml-1">
                <template #icon>
                    <i class="iconfont icon-apk text-gray-400"></i>
                </template>
            </a-button>
            <template #content>
                <a-doption @click="appManagerDialog?.show(props.device)">{{ $t("管理应用") }} </a-doption>
                <a-doption @click="appInstallDialog?.show(props.device)">{{ $t("安装应用") }} </a-doption>
            </template>
        </a-dropdown>
    </a-tooltip>
    <DeviceAppManagerDialog ref="appManagerDialog" />
    <DeviceAppInstallDialog ref="appInstallDialog" />
</template>

<style scoped></style>
