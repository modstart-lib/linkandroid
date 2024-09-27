<script setup lang="ts">
import {DeviceRecord, EnumDeviceStatus} from "../../types/Device";
import {Dialog} from "../../lib/dialog";
import {t} from "../../lang";
import {parseIPPort} from "../../lib/linkandroid";

const props = defineProps<{
    device: DeviceRecord
}>()
const doDisconnect = async () => {
    if (props.device.status !== EnumDeviceStatus.CONNECTED) {
        Dialog.tipError(t('设备未连接'))
        return
    }
    Dialog.loadingOn(t('正在断开连接'))
    try {
        const {ip, port} = parseIPPort(props.device.id)
        await window.$mapi.adb.disconnect(ip, port)
        Dialog.tipSuccess(t('断开设备成功'))
    } catch (e) {
        Dialog.tipError(t('断开设备失败'))
    } finally {
        Dialog.loadingOff()
    }
}
</script>

<template>
    <a-doption @click="doDisconnect">
        {{ $t('断开连接') }}
    </a-doption>
</template>

<style scoped>

</style>
