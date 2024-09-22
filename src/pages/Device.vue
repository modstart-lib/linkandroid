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
import {t} from "../lang";
import DeviceFileManagerDialog from "../components/DeviceFileManagerDialog.vue";
import DeviceConnectWifiDialog from "../components/DeviceConnectWifiDialog.vue";
import DeviceShellDialog from "../components/DeviceShellDialog.vue";
import DeviceAdbShellDialog from "../components/DeviceAdbShellDialog.vue";
import DeviceActionApp from "../components/DeviceActionApp.vue";
import DeviceActionRecord from "../components/DeviceActionRecord.vue";
import DeviceActionScreenshot from "../components/DeviceActionScreenshot.vue";

const infoDialog = ref<InstanceType<typeof DeviceInfoDialog> | null>(null);
const fileManagerDialog = ref<InstanceType<typeof DeviceFileManagerDialog> | null>(null);
const shellDialog = ref<InstanceType<typeof DeviceShellDialog> | null>(null);
const adbShellDialog = ref<InstanceType<typeof DeviceAdbShellDialog> | null>(null);
const connectWifiDialog = ref<InstanceType<typeof DeviceConnectWifiDialog> | null>(null);

const deviceStore = useDeviceStore()

const doMirror = async (device: DeviceRecord) => {
    if (device.status !== EnumDeviceStatus.CONNECTED) {
        Dialog.tipError(t('设备未连接'))
        return
    }
    Dialog.loadingOn(t('正在投屏'))
    try {
        const mirroring = window.$mapi.scrcpy.mirror(device.id, {
            title: device.name as string,
            args: '--always-on-top',
        })
        Dialog.loadingOff()
        await sleep(1000)
        await mirroring
    } catch (error) {
        Dialog.tipError(mapError(error))
    }
}


const doRefresh = async () => {
    Dialog.loadingOn(t('正在刷新设备'))
    try {
        await deviceStore.refresh()
        Dialog.tipSuccess(t('刷新设备成功'))
    } catch (e) {
        Dialog.tipError(mapError(e))
    } finally {
        Dialog.loadingOff()
    }
}

const doDelete = async (device: DeviceRecord) => {
    Dialog.confirm(t('确定删除设备？')).then(async () => {
        Dialog.loadingOn(t('正在删除'))
        try {
            await deviceStore.delete(device)
            Dialog.tipSuccess(t('删除成功'))
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
        Dialog.tipSuccess(t('设备编辑成功'))
    } catch (e) {
        Dialog.tipError(mapError(e))
    }
}

</script>

<template>
    <div class="p-8">
        <div class="mb-4 flex items-center">
            <div class="text-3xl font-bold flex-grow">
                {{ $t('设备') }}
            </div>
            <div class="flex items-center">
                <a-button @click="doRefresh" class="ml-1">
                    <template #icon>
                        <icon-refresh/>
                    </template>
                    {{ $t('刷新') }}
                </a-button>
                <a-button @click="connectWifiDialog?.show()" class="ml-1">
                    <template #icon>
                        <icon-link/>
                    </template>
                    {{ $t('连接Wifi设备') }}
                </a-button>
                <a-dropdown trigger="hover">
                    <a-button class="ml-1">
                        <template #icon>
                            <icon-caret-down/>
                        </template>
                    </a-button>
                    <template #content>
                        <a-doption @click="shellDialog?.show()">{{ $t('命令行工具') }}</a-doption>
                    </template>
                </a-dropdown>
            </div>
        </div>
        <div class="-mx-2">
            <div v-if="!deviceStore.records.length" class="py-20">
                <div class="mb-6">
                    <a-empty :description="$t('还没有设备，使用USB连接电脑开始使用～')"/>
                </div>
                <div class="text-center">
                    <a-button v-if="deviceStore.records.length>0"
                              type="primary" @click="doRefresh">
                        <icon-refresh class="mr-1"/>
                        {{ $t('刷新') }}
                    </a-button>
                </div>
            </div>
            <div v-else class="flex flex-wrap">
                <div v-for="(r,rIndex) in deviceStore.records" :key="rIndex" class="w-full lg:w-1/2 2xl:w-1/3 p-3">
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
                                <a-tooltip :content="$t('投屏到电脑')">
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
                                <DeviceActionApp :device="r"/>
                                <DeviceActionScreenshot :device="r"/>
                                <DeviceActionRecord :device="r"/>
                                <a-tooltip :content="$t('文件管理')">
                                    <a-button class="ml-1" @click="fileManagerDialog?.show(r)">
                                        <template #icon>
                                            <icon-folder class="text-gray-400"/>
                                        </template>
                                    </a-button>
                                </a-tooltip>
                                <a-dropdown trigger="hover">
                                    <a-button class="ml-1">
                                        <template #icon>
                                            <icon-settings class="text-gray-400"/>
                                        </template>
                                    </a-button>
                                    <template #content>
                                        <a-doption @click="adbShellDialog?.show(r)">{{ $t('命令行') }}</a-doption>
                                        <a-doption @click="infoDialog?.show(r)">{{ $t('设备详情') }}</a-doption>
                                        <a-doption v-if="r.status===EnumDeviceStatus.DISCONNECTED" @click="doDelete(r)">
                                            {{ $t('删除设备') }}
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
    <DeviceConnectWifiDialog ref="connectWifiDialog"/>
    <DeviceInfoDialog ref="infoDialog"/>
    <DeviceFileManagerDialog ref="fileManagerDialog"/>
    <DeviceShellDialog ref="shellDialog"/>
    <DeviceAdbShellDialog ref="adbShellDialog"/>
</template>

<style scoped>

</style>
