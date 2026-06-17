<script setup lang="ts">
import {t} from '../../lang'
import {Dialog} from '../../lib/dialog'
import {mapError} from '../../lib/error'
import {DeviceRecord, EnumDeviceStatus} from '../../types/Device'

const props = defineProps<{
    device: DeviceRecord
}>()

const doScreenshot = async () => {
    if (props.device.status !== EnumDeviceStatus.CONNECTED) {
        Dialog.tipError(t('device.notConnected'))
        return
    }
    try {
        const image = await window.$mapi.adb.screencap(props.device.id)
        const base64 = 'data:image/png;base64,' + image
        await window.$mapi.app.windowOpen('thirdPartyImageBeautifier')
        await window.$mapi.event.callPage('thirdPartyImageBeautifier', 'doSetImage', base64)
    } catch (error) {
        Dialog.tipError(mapError(error))
    }
}
</script>

<template>
    <a-tooltip :content="$t('device.screenshot')">
        <a-button class="ml-1" @click="doScreenshot()">
            <template #icon>
                <i-mdi-camera class="text-gray-400" />
            </template>
        </a-button>
    </a-tooltip>
</template>

<style scoped></style>
