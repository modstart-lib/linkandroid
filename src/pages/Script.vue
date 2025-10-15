<script setup lang="ts">
import {useDeviceStore} from "../store/modules/device";
import {Dialog} from "../lib/dialog";
import {mapError} from "../lib/error";
import DeviceSettingDialog from "./Device/DeviceSettingDialog.vue";
import {computed, ref} from "vue";
import {t} from "../lang";
import DeviceFileManagerDialog from "./Device/DeviceFileManagerDialog.vue";
import DeviceConnectWifiDialog from "./Device/DeviceConnectWifiDialog.vue";
import DeviceShellDialog from "./Device/DeviceShellDialog.vue";
import DeviceAdbShellDialog from "./Device/DeviceAdbShellDialog.vue";
import DeviceDefaultSettingDialog from "./Device/DeviceDefaultSettingDialog.vue";

const settingDialog = ref<InstanceType<typeof DeviceSettingDialog> | null>(null);
const fileManagerDialog = ref<InstanceType<typeof DeviceFileManagerDialog> | null>(null);
const shellDialog = ref<InstanceType<typeof DeviceShellDialog> | null>(null);
const adbShellDialog = ref<InstanceType<typeof DeviceAdbShellDialog> | null>(null);
const connectWifiDialog = ref<InstanceType<typeof DeviceConnectWifiDialog> | null>(null);
const defaultSettingDialog = ref<InstanceType<typeof DeviceDefaultSettingDialog> | null>(null);

const deviceStore = useDeviceStore();

const searchKeywords = ref("");
const filterRecords = computed(() => {
    return deviceStore.records.filter(r => {
        const keywords = searchKeywords.value.toLowerCase();
        if (keywords) {
            if (r.name?.toLowerCase().includes(keywords)) {
                return true;
            }
            return false;
        }
        return true;
    });
});

const doRefresh = async () => {
    Dialog.loadingOn(t("正在刷新设备"));
    try {
        await deviceStore.refresh();
        Dialog.tipSuccess(t("刷新设备成功"));
    } catch (e) {
        Dialog.tipError(mapError(e));
    } finally {
        Dialog.loadingOff();
    }
};
</script>

<template>
    <div
        class="pb-script-container min-h-[calc(100vh-4rem)] relative select-none"
        :class="{'has-records': deviceStore.records.length > 0}"
    >
        <div class="pb-header flex items-center sticky top-0 bg-white px-8 py-2 my-4"
             style="z-index:1;">
            <div class="text-3xl font-bold flex-grow">
                {{ $t("脚本") }}
            </div>
            <div class="flex items-center">
                <a-input-search
                    v-if="deviceStore.records.length > 0"
                    v-model="searchKeywords"
                    :placeholder="$t('搜索脚本')"
                    class="w-48"
                    allow-clear
                />
            </div>
        </div>
        <div class="px-8">
            <div class="py-32 text-center">
                <div class="mb-10">
                    <icon-robot class="text-5xl"/>
                </div>
                <div class="text-gray-400">
                    {{ $t("功能正在开发中，敬请期待") }}
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped lang="less">

[data-theme="dark"] {
    .pb-script-container {
        background-color: var(--color-background);

        .pb-header {
            background-color: var(--color-background);
        }
    }
}
</style>
