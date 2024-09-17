<script setup lang="ts">
import {useDeviceStore} from "../store/modules/device";
import {DeviceRecord, EnumDeviceStatus} from "../types/Device";
import {sleep} from "../lib/util";
import DeviceStatus from "../components/DeviceStatus.vue";
import {Dialog} from "../lib/dialog";
import {mapError} from "../lib/linkandroid";
import InputInlineEditor from "../components/common/InputInlineEditor.vue";
import DeviceInfoDialog from "../components/DeviceInfoDialog.vue";
import {ref} from "vue";
import {i18nTrans} from "../lang";

const onStdout = (data) => {
    console.log('stdout', data)
}
const onStderr = (data) => {
    console.log('stderr', data)
}

const infoDialog = ref<InstanceType<typeof DeviceInfoDialog> | null>(null);
const deviceStore = useDeviceStore()
const doMirror = async (device: DeviceRecord) => {
    if (device.status !== EnumDeviceStatus.CONNECTED) {
        Dialog.tipError(i18nTrans('device.status.notConnected'))
        return
    }
    try {
        const mirroring = window.$mapi.scrcpy.mirror(device.id, {
            title: device.name as string,
            args: '--always-on-top',
            exec: false,
            option: {
                stdout: onStdout,
                stderr: onStderr,
            }
        })
        await sleep(1000)
        await mirroring
    } catch (error) {
        Dialog.tipError(mapError(error))
    }
}

const doFileManager = async (device: DeviceRecord) => {
    // if (device.status !== EnumDeviceStatus.CONNECTED) {
    //     Dialog.tipError('设备未连接')
    //     return
    // }
    Dialog.tipError(i18nTrans('underdevelopment'))
    // console.log('xxx', await window.$mapi.adb.fileList(device.id, '/'))
}

const doConnectWifi = async () => {
    Dialog.tipError(i18nTrans('underdevelopment'))
    // Dialog.loadingOn('正在连接Wifi设备...')
    // try {
    //     await deviceStore.connectWifi()
    //     Dialog.tipSuccess('连接Wifi设备成功')
    // } catch (e) {
    //     Dialog.tipError(mapError(e))
    // } finally {
    //     Dialog.loadingOff()
    // }
}

const doRefresh = async () => {
    Dialog.loadingOn(i18nTrans('device.refresh.loading'))
    try {
        await deviceStore.refresh()
        Dialog.tipSuccess(i18nTrans('device.refresh.success'))
    } catch (e) {
        Dialog.tipError(mapError(e))
    } finally {
        Dialog.loadingOff()
    }
}

const doDelete = async (device: DeviceRecord) => {
    Dialog.confirm(i18nTrans('device.delete.confirm')).then(async () => {
        Dialog.loadingOn(i18nTrans('device.delete.loading'))
        try {
            await deviceStore.delete(device)
            Dialog.tipSuccess(i18nTrans('device.delete.success'))
        } catch (e) {
            Dialog.tipError(mapError(e))
        } finally {
            Dialog.loadingOff()
        }
    })
}

const onEditName = async (device: DeviceRecord, name: string) => {
    try {
        await deviceStore.edit(device, {name})
        Dialog.tipSuccess(i18nTrans('device.editName.success'))
    } catch (e) {
        Dialog.tipError(mapError(e))
    }
}

</script>

<template>
    <div class="p-8">
        <div class="mb-4 flex items-center">
            <div class="text-3xl font-bold flex-grow">
                {{ $t('device.title') }}
            </div>
            <div>
                <a-button @click="doConnectWifi" class="ml-1">
                    <icon-link class="mr-1"/>
                    {{ $t('device.connectWifiDevice') }}
                </a-button>
                <a-button @click="doRefresh" class="ml-1">
                    <icon-refresh class="mr-1"/>
                    {{ $t('refresh') }}
                </a-button>
            </div>
        </div>
        <div class="-mx-2">
            <div v-if="!deviceStore.records.length" class="py-20">
                <div class="mb-6">
                    <a-empty :description="$t('device.emptyTip')"/>
                </div>
                <div class="text-center">
                    <a-button v-if="deviceStore.records.length>0"
                              type="primary" @click="doRefresh">
                        <icon-refresh class="mr-1"/>
                        {{ $t('refresh') }}
                    </a-button>
                </div>
            </div>
            <div v-else class="flex flex-wrap">
                <div v-for="(r,rIndex) in deviceStore.records" :key="rIndex" class="w-1/3 2xl:w-1/4 p-3">
                    <div
                        class="hover:shadow-lg shadow border border-solid h-64 border-gray-100 rounded-lg flex flex-col">
                        <div class="flex overflow-hidden flex-shrink-0 items-center h-12 px-4 py-2">
                            <div class="overflow-hidden">
                                <div class="font-bold truncate cursor-pointer">
                                    <span>
                                        {{ r.name }}
                                    </span>
                                </div>
                            </div>
                            <div class="flex-grow">
                                <InputInlineEditor :value="r.name" @change="onEditName(r,$event)">
                                    <a class="ml-1 text-gray-400" href="javascript:;">
                                        <icon-pen/>
                                    </a>
                                </InputInlineEditor>
                            </div>
                            <div class="w-28 flex-shrink-0 text-right">
                                <DeviceStatus :status="r.status"/>
                            </div>
                        </div>
                        <div class="h-52 relative">
                            <div class="absolute bottom-0 left-0 p-4">
                                <a-tooltip :content="$t('device.mirrorToDesktop')">
                                    <div
                                        @click="doMirror(r)"
                                        class="cursor-pointer border-4 border-b-8 border-solid border-black rounded-lg shadow-2xl text-center overflow-hidden">
                                        <div v-if="r.screenshot">
                                            <img :src="r.screenshot" class="max-h-44 max-w-44"/>
                                        </div>
                                        <div v-else class="w-24 h-44 bg-gray-200 text-xs text-gray-400 flex">
                                            <div class="m-auto">PREVIEW</div>
                                        </div>
                                    </div>
                                </a-tooltip>
                            </div>
                            <div class="absolute bottom-0 right-0 p-4">
                                <a-tooltip :content="$t('device.fileManager.title')">
                                    <a-button class="mr-1"
                                              @click="doFileManager(r)">
                                        <template #icon>
                                            <icon-folder class="text-gray-400"/>
                                        </template>
                                    </a-button>
                                </a-tooltip>
                                <a-dropdown>
                                    <a-button>
                                        <template #icon>
                                            <icon-settings class="text-gray-400"/>
                                        </template>
                                    </a-button>
                                    <template #content>
                                        <a-doption @click="infoDialog?.show(r)">{{ $t('detail') }}</a-doption>
                                        <a-doption v-if="r.status===EnumDeviceStatus.DISCONNECTED"
                                                   @click="doDelete(r)">
                                            {{ $t('delete') }}
                                        </a-doption>
                                    </template>
                                </a-dropdown>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <DeviceInfoDialog ref="infoDialog"/>
</template>

<style scoped>

</style>
