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
    if (device.value.status !== EnumDeviceStatus.CONNECTED) {
        Dialog.tipError(t('设备未连接'))
        return
    }
    Dialog.loadingOn(t('正在进入OTG模式'))
    const args = [
        '--otg',
        '--always-on-top'
    ]
    try {
        const mirrorController = await window.$mapi.scrcpy.mirror(device.value.id, {
            title: device.value.name as string,
            args: args.join(' '),
        })
        await sleep(1000)
        Dialog.tipSuccess(t('进入OTG模式成功'))
    } catch (error) {
        Dialog.tipError(mapError(error))
    } finally {
        Dialog.loadingOff()
    }
}
</script>

<template>
    <a-doption @click="doMirror">
        {{ $t('进入OTG模式') }}
    </a-doption>
</template>

<style scoped>

</style>
