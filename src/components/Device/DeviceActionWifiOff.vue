<script setup lang="ts">
import {DeviceRecord, EnumDeviceStatus} from "../../types/Device";
import {Dialog} from "../../lib/dialog";
import {t} from "../../lang";
import {sleep} from "../../lib/util";
import {parseIPPort} from "../../lib/linkandroid";
import {mapError} from "../../lib/error";

const props = defineProps<{
    device: DeviceRecord
}>()
const doWifiOff = async () => {
    Dialog.loadingOn(t('正在关闭网络设备端口'))
    try {
        await window.$mapi.adb.usb(props.device.id)
        if (props.device.status === EnumDeviceStatus.CONNECTED) {
            const {ip, port} = parseIPPort(props.device.id)
            await window.$mapi.adb.disconnect(ip, port)
        }
        await sleep(1000)
        Dialog.tipSuccess(t('关闭网络设备端口成功'))
    } catch (error) {
        Dialog.tipError(mapError(error))
    } finally {
        Dialog.loadingOff()
    }
}
</script>

<template>
    <a-doption @click="doWifiOff">
        {{ $t('关闭网络设备端口') }}
    </a-doption>
</template>

<style scoped>

</style>
