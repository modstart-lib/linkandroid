<script setup lang="ts">
import {t} from "../../lang";
import {Dialog} from "../../lib/dialog";
import {mapError} from "../../lib/error";
import {sleep} from "../../lib/util";
import {DeviceRecord, EnumDeviceStatus} from "../../types/Device";

const props = defineProps<{
    device: DeviceRecord;
}>();
const doWifiOn = async () => {
    if (props.device.status !== EnumDeviceStatus.CONNECTED) {
        Dialog.tipError(t("device.notConnected"));
        return;
    }
    Dialog.loadingOn(t("device.addingAsNetworkDevice"));
    try {
        const host = await window.$mapi.adb.getDeviceIP(props.device.id);
        if (!host) {
            Dialog.tipError(t("device.noNetworkAddress"));
        }
        const port = await window.$mapi.adb.tcpip(props.device.id, 5555);
        await sleep(1000);
        await window.$mapi.adb.connect(host, port);
        Dialog.tipSuccess(t("device.addAsNetworkDeviceSuccess"));
    } catch (error) {
        Dialog.tipError(mapError(error));
    } finally {
        Dialog.loadingOff();
    }
};
</script>

<template>
    <a-doption @click="doWifiOn">
        {{ $t("device.addAsNetworkDevice") }}
    </a-doption>
</template>

<style scoped></style>
