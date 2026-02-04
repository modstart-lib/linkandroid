<script setup lang="ts">
import {t} from "../../lang";
import {Dialog} from "../../lib/dialog";
import {mapError} from "../../lib/error";
import {sleep} from "../../lib/util";
import {DeviceRecord, EnumDeviceStatus} from "../../types/Device";

const props = defineProps<{
    device: DeviceRecord;
}>();
const doMirror = async () => {
    if (props.device.status !== EnumDeviceStatus.CONNECTED) {
        Dialog.tipError(t("device.notConnected"));
        return;
    }
    const info = await window.$mapi.adb.info(props.device.id);
    if (info.version < 12) {
        Dialog.tipError(t("device.versionLow"));
        return;
    }
    Dialog.loadingOn(t("device.openingCamera"));
    const args = [
        '--video-source', 'camera',
        "--always-on-top",
    ];
    try {
        const mirrorController = await $mapi.scrcpy.mirror(props.device.id, {
            title: props.device.name as string,
            args,
        });
        await sleep(1000);
        Dialog.tipSuccess(t("device.openCameraSuccess"));
    } catch (error) {
        Dialog.tipError(mapError(error));
    } finally {
        Dialog.loadingOff();
    }
};
</script>

<template>
    <a-doption @click="doMirror">
        {{ $t("device.openCamera") }}
    </a-doption>
</template>

<style scoped></style>
