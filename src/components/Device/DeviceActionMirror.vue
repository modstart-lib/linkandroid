<script setup lang="ts">
import {DeviceRecord, EnumDeviceStatus} from "../../types/Device";
import {Dialog} from "../../lib/dialog";
import {t} from "../../lang";
import {sleep} from "../../lib/util";
import {mapError} from "../../lib/linkandroid";
import {ref} from "vue";

const props = defineProps<{
    device: DeviceRecord
}>()

const mirrorController = ref<null | any>(null)

const doMirror = async () => {
    console.log('doMirror')
    if (props.device.status !== EnumDeviceStatus.CONNECTED) {
        Dialog.tipError(t('设备未连接'))
        return
    }
    Dialog.loadingOn(t('正在投屏'))
    try {
        mirrorController.value = await window.$mapi.scrcpy.mirror(props.device.id, {
            title: props.device.name as string,
            args: '--always-on-top',
            stdout: (data: string) => {
                console.log('stdout', data)
            },
            stderr: (data: string) => {
                console.error('stderr', data)
            },
            success: (code: number) => {
                console.log('success', code)
                mirrorController.value = null
            },
            error: (code: number) => {
                console.error('error', code)
                mirrorController.value = null
            }
        })
        await sleep(1000)
        Dialog.tipSuccess(t('投屏成功'))
    } catch (error) {
        Dialog.tipError(mapError(error))
    } finally {
        Dialog.loadingOff()
    }
}
const start = () => {
    doMirror().then()
}
defineExpose({
    start
})
</script>

<template>
    <a-tooltip :content="$t('投屏到电脑')">
        <a-button class="ml-1" :type="mirrorController?'primary':undefined" @click="doMirror()">
            <template #icon>
                <i class="iconfont icon-mirror" :class="mirrorController?'':'text-gray-400'"></i>
            </template>
        </a-button>
    </a-tooltip>
</template>

<style scoped>

</style>
