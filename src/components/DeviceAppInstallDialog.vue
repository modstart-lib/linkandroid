<script setup lang="ts">
import {ref} from "vue";
import {Dialog} from "../lib/dialog";
import {t} from "../lang";
import {DeviceRecord, EnumDeviceStatus} from "../types/Device";

const visible = ref(false)
const device = ref({} as DeviceRecord)

const show = (d: DeviceRecord) => {
    if (d.status !== EnumDeviceStatus.CONNECTED) {
        Dialog.tipError(t('设备未连接'))
        return
    }
    device.value = d
    window.$mapi.file.openFile().then((path: string) => {
        if (path) {
            Dialog.loadingOn(t('正在安装'))
            console.log('install', device.value.id, path)
            window.$mapi.adb.install(device.value.id, path)
                .then(() => {
                    Dialog.loadingOff()
                    Dialog.tipSuccess(t('安装成功'))
                })
                .catch((err) => {
                    Dialog.loadingOff()
                    Dialog.tipError(t('安装失败') + ':' + err)
                })
        }
    })
}
defineExpose({
    show
})
</script>

<template>
    <a-modal v-model:visible="visible"
             width="40rem"
             title-align="start">
        <template #title>
            {{ $t('安装应用') }}
        </template>
        <template #footer>
            <div></div>
        </template>
        <div>
            <div class="px-2 h-48 bg-gray-100">

            </div>
        </div>
    </a-modal>
</template>

