<script setup lang="ts">
import {computed, ref} from "vue";
import {t} from "../lang";
import {Dialog} from "../lib/dialog";
import {mapError} from "../lib/error";
import {useDeviceStore} from "../store/modules/device";
import DeviceAdbShellDialog from "./Device/DeviceAdbShellDialog.vue";
import DeviceConnectWifiDialog from "./Device/DeviceConnectWifiDialog.vue";
import DeviceDefaultSettingDialog from "./Device/DeviceDefaultSettingDialog.vue";
import DeviceFileManagerDialog from "./Device/DeviceFileManagerDialog.vue";
import DeviceSettingDialog from "./Device/DeviceSettingDialog.vue";
import DeviceShellDialog from "./Device/DeviceShellDialog.vue";

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
    Dialog.loadingOn(t("device.refreshing"));
    try {
        await deviceStore.refresh();
        Dialog.tipSuccess(t("device.refreshSuccess"));
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
                {{ $t("page.script.title") }}
            </div>
            <div class="flex items-center">
                <a-input-search
                    v-if="deviceStore.records.length > 0"
                    v-model="searchKeywords"
                    :placeholder="$t('page.script.searchPlaceholder')"
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
                    {{ $t("page.script.comingSoon") }}
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
