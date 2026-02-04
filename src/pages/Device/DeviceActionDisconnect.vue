<script setup lang="ts">
import {DeviceRecord, EnumDeviceStatus} from "../../types/Device";
import {Dialog} from "../../lib/dialog";
import {t} from "../../lang";
import {parseIPPort} from "../../lib/linkandroid";

const props = defineProps<{
    device: DeviceRecord;
}>();
const doDisconnect = async () => {
    if (props.device.status !== EnumDeviceStatus.CONNECTED) {
        Dialog.tipError(t("device.notConnected"));
        return;
    }
    Dialog.loadingOn(t("device.disconnecting"));
    try {
        const {ip, port} = parseIPPort(props.device.id);
        await window.$mapi.adb.disconnect(ip, port);
        Dialog.tipSuccess(t("device.disconnectSuccess"));
    } catch (e) {
        Dialog.tipError(t("device.disconnectFailed"));
    } finally {
        Dialog.loadingOff();
    }
};
</script>

<template>
    <a-doption @click="doDisconnect">
        {{ $t("device.disconnect") }}
    </a-doption>
</template>

<style scoped></style>
