<script setup lang="ts">
import {ref} from "vue";
import {t} from "../../lang";
import {Dialog} from "../../lib/dialog";
import {DeviceRecord, EnumDeviceStatus} from "../../types/Device";

const visible = ref(false);
const device = ref({} as DeviceRecord);

const show = (d: DeviceRecord) => {
    if (d.status !== EnumDeviceStatus.CONNECTED) {
        Dialog.tipError(t("device.notConnected"));
        return;
    }
    device.value = d;
    window.$mapi.file.openFile().then((path) => {
        if (path) {
            Dialog.loadingOn(t("device.installing"));
            window.$mapi.adb
                .install(device.value.id, path)
                .then(() => {
                    Dialog.loadingOff();
                    Dialog.tipSuccess(t("device.installSuccess"));
                })
                .catch(err => {
                    Dialog.loadingOff();
                    Dialog.tipError(t("device.installFailed") + ":" + err);
                });
        }
    });
};
defineExpose({
    show,
});
</script>

<template>
    <a-modal v-model:visible="visible" width="40rem" title-align="start">
        <template #title>
            {{ $t("device.installApp") }}
        </template>
        <template #footer>
            <div></div>
        </template>
        <div>
            <div class="px-2 h-48 bg-gray-100"></div>
        </div>
    </a-modal>
</template>
