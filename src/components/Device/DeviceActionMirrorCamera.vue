<script setup lang="ts">

import {DeviceRecord, EnumDeviceStatus} from "../../types/Device";
import {Dialog} from "../../lib/dialog";
import {t} from "../../lang";
import {sleep} from "../../lib/util";
import {mapError} from "../../lib/linkandroid";

const props = defineProps<{
    device: DeviceRecord
}>()
const doMirror = async () => {
    if (props.device.status !== EnumDeviceStatus.CONNECTED) {
        Dialog.tipError(t('设备未连接'))
        return
    }
    const info = await window.$mapi.adb.info(props.device.id)
    if (!info) {
        Dialog.tipError(t('获取设备信息失败'))
        return
    }
    if (info.version < 12) {
        Dialog.tipError(t('设备版本过低，不支持此功能'))
        return
    }
    Dialog.loadingOn(t('正在打开摄像头'))
    const args = [
        '--video-source=camera',
        '--always-on-top'
    ]
    try {
        const mirrorController = await window.$mapi.scrcpy.mirror(props.device.id, {
            title: props.device.name as string,
            args: args.join(' '),
        })
        await sleep(1000)
        Dialog.tipSuccess(t('打开摄像头成功'))
    } catch (error) {
        Dialog.tipError(mapError(error))
    } finally {
        Dialog.loadingOff()
    }
}
</script>

<template>
    <a-doption @click="doMirror">
        {{ $t('打开摄像头') }}
    </a-doption>
</template>

<style scoped>

</style>
