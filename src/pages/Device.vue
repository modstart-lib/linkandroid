<script setup lang="ts">
import { computed, ref } from "vue";
import { t } from "../lang";
import { Dialog } from "../lib/dialog";
import { mapError } from "../lib/error";
import { useDeviceStore } from "../store/modules/device";
import DeviceAdbShellDialog from "./Device/DeviceAdbShellDialog.vue";
import DeviceConnectWifiDialog from "./Device/DeviceConnectWifiDialog.vue";
import DeviceDefaultSettingDialog from "./Device/DeviceDefaultSettingDialog.vue";
import DeviceEmpty from "./Device/DeviceEmpty.vue";
import DeviceFileManagerDialog from "./Device/DeviceFileManagerDialog.vue";
import DeviceFilterEmpty from "./Device/DeviceFilterEmpty.vue";
import DeviceItem from "./Device/DeviceItem.vue";
import DeviceSettingDialog from "./Device/DeviceSettingDialog.vue";
import DeviceShellDialog from "./Device/DeviceShellDialog.vue";
import DeviceWirelessPairingDialog from "./Device/DeviceWirelessPairingDialog.vue";

const settingDialog = ref<InstanceType<typeof DeviceSettingDialog> | null>(null);
const fileManagerDialog = ref<InstanceType<typeof DeviceFileManagerDialog> | null>(null);
const shellDialog = ref<InstanceType<typeof DeviceShellDialog> | null>(null);
const adbShellDialog = ref<InstanceType<typeof DeviceAdbShellDialog> | null>(null);
const connectWifiDialog = ref<InstanceType<typeof DeviceConnectWifiDialog> | null>(null);
const wirelessPairingDialog = ref<InstanceType<typeof DeviceWirelessPairingDialog> | null>(null);
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
        class="pb-device-container min-h-[calc(100vh-4rem)] relative select-none"
        :class="{'has-records': deviceStore.records.length > 0}"
    >
        <div class="pb-header flex items-center sticky top-0 bg-white px-8 py-2 my-4"
             style="z-index:1;">
            <div class="text-3xl font-bold flex-grow">
                {{ $t("device.title") }}
            </div>
            <div class="mr-5">
                <a target="_blank" class="text-red-500" href="https://linkandroid.com/forum">
                    <icon-message class="mr-1"/>
                    {{ $t("page.feedback.help") }}
                </a>
            </div>
            <div class="flex items-center">
                <a-input-search
                    v-if="deviceStore.records.length > 0"
                    v-model="searchKeywords"
                    :placeholder="$t('device.searchPlaceholder')"
                    class="w-48"
                    allow-clear
                />
                <a-button @click="doRefresh" class="ml-1">
                    <template #icon>
                        <icon-refresh/>
                    </template>
                    {{ $t("device.refresh") }}
                </a-button>
                <a-dropdown trigger="hover">
                    <a-button class="ml-1">
                        <template #icon>
                            <icon-link/>
                        </template>
                        {{ $t("device.connect") }}
                    </a-button>
                    <template #content>
                        <a-doption @click="connectWifiDialog?.show()">
                            <template #icon>
                                <icon-link/>
                            </template>
                            {{ $t("device.connectNetwork") }}
                        </a-doption>
                        <a-doption @click="wirelessPairingDialog?.show()">
                            <template #icon>
                                <icon-qrcode/>
                            </template>
                            {{ $t("device.wirelessPairing") }}
                        </a-doption>
                    </template>
                </a-dropdown>
                <a-dropdown trigger="hover">
                    <a-button class="ml-1">
                        <template #icon>
                            <icon-caret-down/>
                        </template>
                    </a-button>
                    <template #content>
                        <a-doption @click="shellDialog?.show()">{{ $t("device.commandLineTool") }}</a-doption>
                        <a-doption @click="defaultSettingDialog?.show()">{{ $t("device.defaultSettings") }}</a-doption>
                    </template>
                </a-dropdown>
            </div>
        </div>
        <div class="px-8">
            <DeviceEmpty v-if="!deviceStore.records.length"/>
            <DeviceFilterEmpty v-else-if="!filterRecords.length"/>
            <div v-else class="flex flex-wrap">
                <div v-for="(r, rIndex) in filterRecords" :key="rIndex"
                     class="p-1 w-52 max-w-96 flex-grow">
                    <DeviceItem :record="r"
                                @file-manager="fileManagerDialog?.show(r)"
                                @setting="settingDialog?.show(r)"
                                @adb-shell="adbShellDialog?.show(r)"
                    />
                </div>
            </div>
        </div>
    </div>
    <DeviceConnectWifiDialog ref="connectWifiDialog" @update="doRefresh"/>
    <DeviceWirelessPairingDialog ref="wirelessPairingDialog" @update="doRefresh"/>
    <DeviceSettingDialog ref="settingDialog"/>
    <DeviceFileManagerDialog ref="fileManagerDialog"/>
    <DeviceAdbShellDialog ref="adbShellDialog"/>
    <DeviceShellDialog ref="shellDialog"/>
    <DeviceDefaultSettingDialog ref="defaultSettingDialog"/>
</template>

<style scoped lang="less">
.pb-device-container {
    &.has-records:after {
        content: '';
        position: absolute;
        bottom: 0;
        right: 0;
        width: 15rem;
        height: 15rem;
        background-image: url("./../assets/image/device-bg.svg");
        background-size: contain;
        background-position: bottom;
        background-blend-mode: lighten;
        background-color: transparent;
        background-repeat: no-repeat;
        opacity: 0.5;
    }
}

[data-theme="dark"] {
    .pb-device-container {
        background-color: var(--color-background);

        .pb-header {
            background-color: var(--color-background);
        }
    }
}
</style>
