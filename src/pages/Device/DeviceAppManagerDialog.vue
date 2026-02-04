<script setup lang="ts">
import {computed, ref} from "vue";
import {t} from "../../lang";
import {Dialog} from "../../lib/dialog";
import {DeviceRecord, EnumDeviceStatus} from "../../types/Device";
import NameInfo from "./App/NameInfo.json";
import DeviceAppIcon from "./DeviceAppIcon.vue";
import DeviceAppInstallDialog from "./DeviceAppInstallDialog.vue";

const appInstallDialog = ref<InstanceType<typeof DeviceAppInstallDialog> | null>(null);

const visible = ref(false);
const device = ref({} as DeviceRecord);
const appRecords = ref([] as any[]);
const searchKeywords = ref("");
const show = (d: DeviceRecord) => {
    if (d.status !== EnumDeviceStatus.CONNECTED) {
        Dialog.tipError(t("device.notConnected"));
        return;
    }
    device.value = d;
    visible.value = true;
    doRefresh().then();
};

const filterAppRecords = computed(() => {
    const keywords = searchKeywords.value.toLowerCase();
    if (!keywords) {
        return appRecords.value;
    }
    return appRecords.value.filter(a => {
        return a.name.toLowerCase().includes(keywords) || a.id.toLowerCase().includes(keywords);
    });
});

const doRefresh = async (isManual?: boolean) => {
    const records = await window.$mapi.adb.listApps(device.value.id);
    appRecords.value = records.map(r => {
        return {
            id: r.id,
            name: NameInfo[r.id] || r.name,
        };
    });
    if (isManual) {
        Dialog.tipSuccess(t("common.refresh") + t("common.success"));
    }
};

const doUninstall = async (app: any) => {
    await Dialog.confirm(t("common.deleteConfirm"));
    await window.$mapi.adb.uninstall(device.value.id, app.id);
    await doRefresh();
    Dialog.tipSuccess(t("device.uninstallSuccess"));
};

defineExpose({
    show,
});
</script>

<template>
    <a-modal v-model:visible="visible" width="80vw" :footer="false" title-align="start">
        <template #title>
            {{ $t("device.appManagement") }}
        </template>
        <div style="height: 60vh; margin: -0.5rem" class="">
            <div class="flex flex-col h-full">
                <div class="py-2 flex items-center">
                    <div class="flex-grow">
                        <a-button class="mr-1" @click="appInstallDialog?.show(device)">
                            <template #icon>
                                <icon-plus />
                            </template>
                            {{ $t("device.installApp") }}
                        </a-button>
                        <a-button @click="doRefresh(true)">
                            <template #icon>
                                <icon-refresh />
                            </template>
                            {{ $t("common.refresh") }}
                        </a-button>
                    </div>
                    <div>
                        <a-input v-model="searchKeywords" :placeholder="$t('device.filterPlaceholder')" />
                    </div>
                </div>
                <div class="flex-grow overflow-auto border border-solid border-gray-200 rounded p-2">
                    <div v-for="a in filterAppRecords">
                        <div class="border border-solid border-gray-200 rounded-lg mb-2 p-2 flex items-center">
                            <div class="cursor-pointer w-10 mr-3">
                                <DeviceAppIcon :name="a.id" size="100%" />
                            </div>
                            <div class="text-sm truncate w-32 mr-3">
                                {{ a.name }}
                            </div>
                            <div class="text-sm truncate flex-grow text-gray-500">
                                {{ a.id }}
                            </div>
                            <div>
                                <a-button @click="doUninstall(a)">
                                    {{ $t("device.uninstall") }}
                                </a-button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </a-modal>
    <DeviceAppInstallDialog ref="appInstallDialog" />
</template>
