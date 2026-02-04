<script setup lang="ts">
import {t} from "../../lang";
import {Dialog} from "../../lib/dialog";
import {mapError} from "../../lib/error";
import {parseIPPort} from "../../lib/linkandroid";
import {sleep} from "../../lib/util";
import {DeviceRecord, EnumDeviceStatus} from "../../types/Device";

const props = defineProps<{
    device: DeviceRecord;
}>();
const doWifiOff = async () => {
    Dialog.loadingOn(t("device.closingNetworkPort"));
    try {
        await window.$mapi.adb.usb(props.device.id);
        if (props.device.status === EnumDeviceStatus.CONNECTED) {
            const {ip, port} = parseIPPort(props.device.id);
            await window.$mapi.adb.disconnect(ip, port);
        }
        await sleep(1000);
        Dialog.tipSuccess(t("device.closeNetworkPortSuccess"));
    } catch (error) {
        Dialog.tipError(mapError(error));
    } finally {
        Dialog.loadingOff();
    }
};
</script>

<template>
    <a-doption @click="doWifiOff">
        {{ $t("device.closeNetworkPort") }}
    </a-doption>
</template>

<style scoped></style>
