<script setup lang="ts">
import {DeviceRecord, EnumDeviceStatus} from "../../types/Device";
import {Dialog} from "../../lib/dialog";
import {t} from "../../lang";
import {parseIPPort} from "../../lib/linkandroid";

const props = defineProps<{
    device: DeviceRecord;
}>();
const doConnect = async () => {
    if (props.device.status !== EnumDeviceStatus.DISCONNECTED) {
        Dialog.tipError(t("设备状态异常"));
        return;
    }
    Dialog.loadingOn(t("正在连接设备"));
    try {
        const {ip, port} = parseIPPort(props.device.id);
        await window.$mapi.adb.connect(ip, port);
        Dialog.tipSuccess(t("设备连接成功"));
    } catch (e) {
        Dialog.tipError(t("设备连接失败"));
    } finally {
        Dialog.loadingOff();
    }
};
</script>

<template>
    <a-doption @click="doConnect">
        {{ $t("连接设备") }}
    </a-doption>
</template>

<style scoped></style>
