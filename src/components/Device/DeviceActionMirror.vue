<script setup lang="ts">
import {DeviceRecord} from "../../types/Device";
import {useDeviceStore} from "../../store/modules/device";
import {Dialog} from "../../lib/dialog";
import {t} from "../../lang";

const props = defineProps<{
    device: DeviceRecord
}>()

const deviceStore = useDeviceStore()

const doMirror = async () => {
    await deviceStore.doMirror(props.device)
}
const start = () => {
    if (props.device.runtime?.mirrorController) {
        Dialog.tipError(t('已经在投屏中'))
        return
    }
    doMirror().then()
}
defineExpose({
    start
})
</script>

<template>
    <a-tooltip :content="$t('投屏到电脑')">
        <a-button class="ml-1" :type="device.runtime?.mirrorController?'primary':undefined" @click="doMirror()">
            <template #icon>
                <i class="iconfont icon-mirror" :class="device.runtime?.mirrorController?'':'text-gray-400'"></i>
            </template>
        </a-button>
    </a-tooltip>
</template>

<style scoped>

</style>
