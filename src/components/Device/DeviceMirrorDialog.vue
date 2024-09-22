<script setup lang="ts">
import {DeviceRecord, EnumDeviceStatus} from "../../types/Device";
import {Dialog} from "../../lib/dialog";
import {t} from "../../lang";
import {sleep} from "../../lib/util";
import {mapError} from "../../lib/linkandroid";
import {ref} from "vue";

const device = ref({} as DeviceRecord)
const show = (d: DeviceRecord) => {
    device.value = d
    doMirror().then()
}
const doMirror = async () => {
    if (device.value.status !== EnumDeviceStatus.CONNECTED) {
        Dialog.tipError(t('设备未连接'))
        return
    }
    Dialog.loadingOn(t('正在投屏'))
    try {
        const mirrorController = await window.$mapi.scrcpy.mirror(device.value.id, {
            title: device.value.name as string,
            args: '--always-on-top',
        })
        await sleep(1000)
        Dialog.tipSuccess(t('投屏成功'))
    } catch (error) {
        Dialog.tipError(mapError(error))
    } finally {
        Dialog.loadingOff()
    }
}
defineExpose({
    show
})
</script>

<template>

</template>

<style scoped>

</style>
