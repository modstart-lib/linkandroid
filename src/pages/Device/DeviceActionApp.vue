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
    <a-tooltip :content="$t('device.appManagement')">
        <a-dropdown trigger="hover">
            <a-button class="ml-1">
                <template #icon>
                    <i class="iconfont icon-apk"></i>
                </template>
            </a-button>
            <template #content>
                <a-doption @click="appManagerDialog?.show(props.device)">{{ $t("device.manageApps") }} </a-doption>
                <a-doption @click="appInstallDialog?.show(props.device)">{{ $t("device.installApp") }} </a-doption>
            </template>
        </a-dropdown>
    </a-tooltip>
    <DeviceAppManagerDialog ref="appManagerDialog" />
    <DeviceAppInstallDialog ref="appInstallDialog" />
</template>

<style scoped></style>
