<script setup lang="ts">
import {t} from '../../lang'
import {Dialog} from '../../lib/dialog'
import {mapError} from '../../lib/error'
import {parseDisplayOverride} from '../../lib/linkandroid'
import {DeviceRecord, EnumDeviceStatus} from '../../types/Device'

const props = defineProps<{
    device: DeviceRecord
}>()

// 手机分辨率可能被其他工具通过 `wm size/density` 修改并持久化，这里提供一键恢复
const doReset = async () => {
    if (props.device.status !== EnumDeviceStatus.CONNECTED) {
        Dialog.tipError(t('device.notConnected'))
        return
    }
    try {
        const wmSize = await $mapi.adb.shell(props.device.id, 'wm size')
        const wmDensity = await $mapi.adb.shell(props.device.id, 'wm density')
        const {overridden, detail} = parseDisplayOverride(wmSize, wmDensity)
        if (!overridden) {
            Dialog.tipSuccess(t('device.displayResetNone'))
            return
        }
        await Dialog.confirm(t('device.displayResetConfirm', {detail}))
        await $mapi.adb.shell(props.device.id, 'wm size reset')
        await $mapi.adb.shell(props.device.id, 'wm density reset')
        Dialog.tipSuccess(t('device.displayResetSuccess'))
    } catch (error) {
        Dialog.tipError(mapError(error))
    }
}
</script>

<template>
    <a-doption @click="doReset">
        <template #icon>
            <i-lucide-monitor-check />
        </template>
        {{ $t('device.displayReset') }}
    </a-doption>
</template>
