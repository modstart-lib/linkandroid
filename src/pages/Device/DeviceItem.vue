<script setup lang="ts">
import {useDeviceStore} from "../../store/modules/device";
import {DeviceRecord, EnumDeviceStatus, EnumDeviceType} from "../../types/Device";
import DeviceStatus from "./DeviceStatus.vue";
import {Dialog} from "../../lib/dialog";
import {mapError} from "../../lib/error";
import InputInlineEditor from "../../components/common/InputInlineEditor.vue";
import {computed, ref} from "vue";
import {t} from "../../lang";
import DeviceActionApp from "./DeviceActionApp.vue";
import DeviceActionRecord from "./DeviceActionRecord.vue";
import DeviceActionScreenshot from "./DeviceActionScreenshot.vue";
import DeviceActionWifiOn from "./DeviceActionWifiOn.vue";
import DeviceActionMirrorCamera from "./DeviceActionMirrorCamera.vue";
import DeviceActionMirrorOTG from "./DeviceActionMirrorOTG.vue";
import DeviceActionMirror from "./DeviceActionMirror.vue";
import DeviceActionDisconnect from "./DeviceActionDisconnect.vue";
import DeviceType from "./DeviceType.vue";
import DeviceActionConnect from "./DeviceActionConnect.vue";
import DeviceActionWifiOff from "./DeviceActionWifiOff.vue";

const props = defineProps<{
    record: DeviceRecord
}>();

const emit = defineEmits<{
    (e: "setting"): void,
    (e: "file-manager"): void,
    (e: "adbShell"): void,
    (e: "wifi-qrcode"): void,
}>();

const actionMirror = ref<InstanceType<typeof DeviceActionMirror> | null>(null);

const deviceStore = useDeviceStore();

const rIndex = computed(() => {
    return deviceStore.records.findIndex(r => r.id === props.record.id);
});

const doDelete = async (device: DeviceRecord) => {
    Dialog.confirm(t("确定删除设备？")).then(async () => {
        Dialog.loadingOn(t("正在删除"));
        try {
            await deviceStore.delete(device);
            Dialog.tipSuccess(t("删除成功"));
        } catch (e) {
            Dialog.tipError(mapError(e));
        } finally {
            Dialog.loadingOff();
        }
    });
};

const onEditName = async (device: DeviceRecord, name: string) => {
    try {
        await deviceStore.edit(device, {name});
        Dialog.tipSuccess(t("设备编辑成功"));
    } catch (e) {
        Dialog.tipError(mapError(e));
    }
};
</script>

<template>

    <div
        class="hover:shadow-lg bg-white dark:bg-gray-800 shadow border border-solid border-gray-100 dark:border-gray-800 rounded-lg flex flex-col p-1"
    >
        <div class="flex overflow-hidden flex-shrink-0 items-center h-8 py-0">
            <div class="overflow-hidden">
                <div class="truncate cursor-pointer">
                    <DeviceType :type="record.type"/>
                    <span>{{ record.name }}</span>
                </div>
            </div>
            <div class="flex-grow">
                <InputInlineEditor :value="record.name" @change="onEditName(record, $event)">
                    <a class="ml-1 text-gray-400" href="javascript:;">
                        <icon-pen/>
                    </a>
                </InputInlineEditor>
            </div>
            <div class="w-16 flex-shrink-0 text-right">
                <DeviceStatus :status="record.status"/>
            </div>
        </div>
        <div class="flex">
            <div class="flex-grow">
                <a-tooltip :content="$t('投屏到电脑')">
                    <div
                        @click="actionMirror?.start()"
                        class="h-64 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                        <div class="cursor-pointer border-4 overflow-hidden border-solid border-black bg-black rounded-lg shadow-2xl">
                            <div v-if="record.screenshot && record.runtime?.previewImage === 'yes'">
                                <img :src="record.screenshot" class="max-h-60 max-w-36 rounded-sm"/>
                            </div>
                            <div v-else class="w-32 h-60 bg-gray-200 text-xs text-gray-300 flex rounded-sm">
                                <div class="m-auto">
                                    <icon-eye class="text-2xl"/>
                                </div>
                            </div>
                        </div>
                    </div>
                </a-tooltip>
            </div>
            <div class="flex-shrink-0 flex flex-col p-0 gap-1 w-9">
                <DeviceActionMirror ref="actionMirror" :device="record"/>
                <DeviceActionApp :device="record"/>
                <DeviceActionScreenshot :device="record"/>
                <DeviceActionRecord :device="record"/>
                <a-tooltip :content="$t('文件管理')">
                    <a-button class="ml-1" @click="emit('file-manager')">
                        <template #icon>
                            <icon-folder class="text-gray-400"/>
                        </template>
                    </a-button>
                </a-tooltip>
                <a-dropdown trigger="hover" :popup-max-height="false">
                    <a-button class="ml-1">
                        <template #icon>
                            <icon-settings class="text-gray-400"/>
                        </template>
                    </a-button>
                    <template #content>
                        <DeviceActionDisconnect
                            v-if="record.type === EnumDeviceType.WIFI &&record.status === EnumDeviceStatus.CONNECTED"
                            :device="record"
                        />
                        <DeviceActionConnect
                            v-if="record.type === EnumDeviceType.WIFI &&record.status === EnumDeviceStatus.DISCONNECTED"
                            :device="record"
                        />
                        <DeviceActionWifiOn v-if="record.type === EnumDeviceType.USB" :device="record"/>
                        <DeviceActionWifiOff v-if="record.type === EnumDeviceType.WIFI" :device="record"/>
                        <a-doption
                            v-if="record.status === EnumDeviceStatus.CONNECTED"
                            @click="emit('wifi-qrcode')"
                        >
                            <template #icon>
                                <icon-qrcode/>
                            </template>
                            {{ $t("设备连接二维码") }}
                        </a-doption>
                        <DeviceActionMirrorCamera :device="record"/>
                        <DeviceActionMirrorOTG v-if="record.type === EnumDeviceType.USB" :device="record"/>
                        <a-doption @click="emit('adbShell')">
                            {{ $t("命令行") }}
                        </a-doption>
                        <a-doption v-if="rIndex > 0" @click="deviceStore.doTop(rIndex)">
                            {{ $t("设备置顶") }}
                        </a-doption>
                        <a-doption @click="emit('setting')">
                            {{ $t("设备设置") }}
                        </a-doption>
                        <a-doption
                            v-if="record.status === EnumDeviceStatus.DISCONNECTED"
                            @click="doDelete(record)"
                        >
                            {{ $t("删除设备") }}
                        </a-doption>
                    </template>
                </a-dropdown>
            </div>
        </div>
    </div>
</template>
