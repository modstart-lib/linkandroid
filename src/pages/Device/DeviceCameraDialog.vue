<script setup lang="ts">
import {onMounted, onUnmounted, ref} from 'vue'
import {t} from '../../lang'
import {testActionSet, testActionUnset} from '../../utils/test'
import {Dialog} from '../../lib/dialog'
import {mapError} from '../../lib/error'
import {sleep} from '../../lib/util'
import {DeviceRecord, EnumDeviceStatus} from '../../types/Device'
import {useDeviceStore} from '../../store/modules/device'

const visible = ref(false)
const device = ref<DeviceRecord | null>(null)

// Camera settings
const cameraId = ref('0')
const cameraSize = ref('')
const cameraFps = ref('')

const resolutionOptions = [
    {label: t('device.cameraResolutionAuto'), value: ''},
    {label: '3840x2160', value: '3840x2160'},
    {label: '1920x1080', value: '1920x1080'},
    {label: '1280x720', value: '1280x720'},
    {label: '640x480', value: '640x480'},
    {label: '320x240', value: '320x240'},
]

const fpsOptions = [
    {label: t('device.cameraFpsAuto'), value: ''},
    {label: '60', value: '60'},
    {label: '30', value: '30'},
    {label: '15', value: '15'},
    {label: '10', value: '10'},
]

const show = (record: DeviceRecord) => {
    if (record.status !== EnumDeviceStatus.CONNECTED) {
        Dialog.tipError(t('device.notConnected'))
        return
    }
    device.value = record
    // Reset to defaults
    cameraId.value = '0'
    cameraSize.value = ''
    cameraFps.value = ''
    visible.value = true
}

const deviceStore = useDeviceStore()

onMounted(() => {
    testActionSet('device.camera.show', () => {
        const record = deviceStore.records[0]
        if (record) show(record)
    })
})

onUnmounted(() => {
    testActionUnset('device.camera.show')
})

const doStartCamera = async () => {
    if (!device.value) return
    if (device.value.status !== EnumDeviceStatus.CONNECTED) {
        Dialog.tipError(t('device.notConnected'))
        return
    }
    const info = await window.$mapi.adb.info(device.value.id)
    if (info.version < 12) {
        Dialog.tipError(t('device.versionLow'))
        return
    }
    visible.value = false
    Dialog.loadingOn(t('device.openingCamera'))

    const args: string[] = ['--video-source', 'camera', '--always-on-top']

    // Camera ID: 0=rear, 1=front
    if (cameraId.value) {
        args.push('--camera-id', cameraId.value)
    }

    // Resolution
    if (cameraSize.value) {
        args.push('--camera-size', cameraSize.value)
    }

    // FPS
    if (cameraFps.value) {
        args.push('--camera-fps', cameraFps.value)
    }

    try {
        await $mapi.scrcpy.mirror(device.value.id, {
            title: device.value.name as string,
            args,
        })
        await sleep(1000)
        Dialog.tipSuccess(t('device.openCameraSuccess'))
    } catch (error) {
        Dialog.tipError(mapError(error))
    } finally {
        Dialog.loadingOff()
    }
}

defineExpose({
    show,
})
</script>

<template>
    <a-modal v-model:visible="visible" width="min(600px, 90vw)" :footer="false" title-align="start">
        <template #title>
            <div class="font-bold">{{ $t('device.cameraSettings') }}</div>
        </template>
        <div class="py-4">
            <div class="mb-5">
                <div class="text-sm text-gray-500 mb-2">{{ $t('device.cameraSelect') }}</div>
                <a-radio-group v-model="cameraId" type="button">
                    <a-radio value="0">
                        <template #icon>
                            <i-mdi-camera-rear />
                        </template>
                        {{ $t('device.cameraRear') }}
                    </a-radio>
                    <a-radio value="1">
                        <template #icon>
                            <i-mdi-camera-front />
                        </template>
                        {{ $t('device.cameraFront') }}
                    </a-radio>
                </a-radio-group>
            </div>
            <div class="mb-5">
                <div class="text-sm text-gray-500 mb-2">{{ $t('device.cameraResolution') }}</div>
                <a-select v-model="cameraSize" :options="resolutionOptions" allow-search />
            </div>
            <div class="mb-5">
                <div class="text-sm text-gray-500 mb-2">{{ $t('device.cameraFps') }}</div>
                <a-select v-model="cameraFps" :options="fpsOptions" />
            </div>
            <div class="flex justify-end gap-2">
                <a-button @click="visible = false">
                    {{ $t('common.cancel') }}
                </a-button>
                <a-button type="primary" @click="doStartCamera">
                    <template #icon>
                        <i-mdi-camera />
                    </template>
                    {{ $t('device.cameraStart') }}
                </a-button>
            </div>
        </div>
    </a-modal>
</template>
