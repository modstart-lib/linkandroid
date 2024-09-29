<script setup lang="ts">
import {DeviceRecord, EnumDeviceStatus} from "../../types/Device";
import {Dialog} from "../../lib/dialog";
import {t} from "../../lang";
import {sleep} from "../../lib/util";
import {mapError} from "../../lib/linkandroid";

const props = defineProps<{
    device: DeviceRecord
}>()
const doWifiOn = async () => {
    if (props.device.status !== EnumDeviceStatus.CONNECTED) {
        Dialog.tipError(t('设备未连接'))
        return
    }
    Dialog.loadingOn(t('正在添加为网络设备'))
    try {
        const host = await window.$mapi.adb.getDeviceIP(props.device.id)
        if (!host) {
            Dialog.tipError(t('没有获取到局域网连接地址，请检查网络'))
        }
        const port = await window.$mapi.adb.tcpip(props.device.id, 5555)
        await sleep(1000)
        await window.$mapi.adb.connect(host, port)
        Dialog.tipSuccess(t('添加为网络设备成功'))
    } catch (error) {
        Dialog.tipError(mapError(error))
    } finally {
        Dialog.loadingOff()
    }
}
</script>

<template>
    <a-doption @click="doWifiOn">
        {{ $t('添加为网络设备') }}
    </a-doption>
</template>

<style scoped>

</style>
