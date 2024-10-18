<script setup lang="ts">
import {useDeviceStore} from "../store/modules/device";
import {DeviceRecord, EnumDeviceStatus, EnumDeviceType} from "../types/Device";
import DeviceStatus from "../components/Device/DeviceStatus.vue";
import {Dialog} from "../lib/dialog";
import {mapError} from "../lib/error";
import InputInlineEditor from "../components/common/InputInlineEditor.vue";
import DeviceSettingDialog from "../components/Device/DeviceSettingDialog.vue";
import {computed, ref} from "vue";
import {t} from "../lang";
import DeviceFileManagerDialog from "../components/Device/DeviceFileManagerDialog.vue";
import DeviceConnectWifiDialog from "../components/Device/DeviceConnectWifiDialog.vue";
import DeviceShellDialog from "../components/Device/DeviceShellDialog.vue";
import DeviceAdbShellDialog from "../components/Device/DeviceAdbShellDialog.vue";
import DeviceActionApp from "../components/Device/DeviceActionApp.vue";
import DeviceActionRecord from "../components/Device/DeviceActionRecord.vue";
import DeviceActionScreenshot from "../components/Device/DeviceActionScreenshot.vue";
import {AppConfig} from "../config";
import DeviceActionWifiOn from "../components/Device/DeviceActionWifiOn.vue";
import DeviceActionMirrorCamera from "../components/Device/DeviceActionMirrorCamera.vue";
import DeviceActionMirrorOTG from "../components/Device/DeviceActionMirrorOTG.vue";
import DeviceActionMirror from "../components/Device/DeviceActionMirror.vue";
import DeviceActionDisconnect from "../components/Device/DeviceActionDisconnect.vue";
import DeviceType from "../components/Device/DeviceType.vue";
import DeviceActionConnect from "../components/Device/DeviceActionConnect.vue";
import DeviceActionWifiOff from "../components/Device/DeviceActionWifiOff.vue";

const settingDialog = ref<InstanceType<typeof DeviceSettingDialog> | null>(null);
const fileManagerDialog = ref<InstanceType<typeof DeviceFileManagerDialog> | null>(null);
const shellDialog = ref<InstanceType<typeof DeviceShellDialog> | null>(null);
const adbShellDialog = ref<InstanceType<typeof DeviceAdbShellDialog> | null>(null);
const connectWifiDialog = ref<InstanceType<typeof DeviceConnectWifiDialog> | null>(null);

const actionMirrors = ref<Record<string, InstanceType<typeof DeviceActionMirror> | null>>({})
const helpShow = ref(false)

const deviceStore = useDeviceStore()

const deviceRecords = computed(() => {
    const records = deviceStore.records
    return records
})

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

const doHelp = () => {
    window.$mapi.app.openExternalWeb(AppConfig.helpUrl)
}

</script>

<template>
    <div class="pb-device-container p-8 min-h-full relative select-none"
         :class="{'has-records':deviceStore.records.length>0}">
        <div class="mb-4 flex items-center">
            <div class="text-3xl font-bold flex-grow">
                {{ $t('设备') }}
            </div>
            <div class="flex items-center">
                <a-button v-if="deviceStore.records.length>0"
                          @click="doRefresh" class="ml-1">
                    <template #icon>
                        <icon-refresh/>
                    </template>
                    {{ $t('刷新') }}
                </a-button>
                <a-button @click="connectWifiDialog?.show()" class="ml-1">
                    <template #icon>
                        <icon-link/>
                    </template>
                    {{ $t('连接网络设备') }}
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
            <div v-if="!deviceRecords.length" class="py-20">
                <div class="text-center">
                    <img class="h-40 m-auto opacity-50" src="./../assets/image/device-empty.svg"/>
                </div>
                <div class="mt-10 text-center text-lg text-gray-400">
                    <div>{{ $t('还没有设备，使用USB连接电脑开始使用～') }}</div>
                </div>
                <div class="mt-10 text-center">
                    <a-button class="mx-1"
                              type="primary" @click="doRefresh">
                        <template #icon>
                            <icon-refresh class="mr-1"/>
                        </template>
                        {{ $t('刷新') }}
                    </a-button>
                    <a-button class="mx-1" @click="helpShow=true">
                        <template #icon>
                            <icon-book class="mr-1"/>
                        </template>
                        {{ $t('如何连接？') }}
                    </a-button>
                </div>
                <div v-if="helpShow" class="pt-5 text-center">
                    <div class="inline-block bg-gray-100 text-left rounded-lg p-6 leading-8">
                        <div>① {{ $t('打开手机USB调试') }}</div>
                        <div>② {{ $t('使用USB连接电脑') }}</div>
                        <div class="pt-3">
                            {{ $t('更多内容，请查看') }}
                            <a href="javascript:;" class="text-link" @click="doHelp">
                                <icon-book/>
                                {{ $t('在线文档') }}
                            </a>
                        </div>
                    </div>
                </div>
            </div>
            <div v-else class="flex flex-wrap">
                <div v-for="(r,rIndex) in deviceRecords" :key="rIndex"
                     class="w-full lg:w-1/2 2xl:w-1/3 p-3">
                    <div
                        class="hover:shadow-lg bg-white shadow border border-solid h-64 border-gray-100 rounded-lg flex flex-col">
                        <div class="flex overflow-hidden flex-shrink-0 items-center h-12 px-4 py-2">
                            <div class="overflow-hidden">
                                <div class="font-bold truncate cursor-pointer">
                                    <DeviceType :type="r.type"/>
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
                                    <div @click="actionMirrors[rIndex]?.start()"
                                         class="cursor-pointer border-4 border-b-8 border-solid border-black rounded-lg shadow-2xl bg-black text-center overflow-hidden">
                                        <div v-if="r.screenshot">
                                            <img :src="r.screenshot" class="max-h-44 max-w-44 rounded-sm"/>
                                        </div>
                                        <div v-else class="w-24 h-44 bg-gray-200 text-xs text-gray-300 flex rounded-sm">
                                            <div class="m-auto">
                                                <icon-eye class="text-2xl"/>
                                            </div>
                                        </div>
                                    </div>
                                </a-tooltip>
                            </div>
                            <div class="absolute bottom-0 right-0 p-4">
                                <DeviceActionMirror ref="actionMirrors" :device="r"/>
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
                                <a-dropdown trigger="hover" :popup-max-height="false">
                                    <a-button class="ml-1">
                                        <template #icon>
                                            <icon-settings class="text-gray-400"/>
                                        </template>
                                    </a-button>
                                    <template #content>
                                        <DeviceActionDisconnect
                                            v-if="r.type===EnumDeviceType.WIFI && r.status===EnumDeviceStatus.CONNECTED"
                                            :device="r"/>
                                        <DeviceActionConnect
                                            v-if="r.type===EnumDeviceType.WIFI && r.status===EnumDeviceStatus.DISCONNECTED"
                                            :device="r"/>
                                        <DeviceActionWifiOn
                                            v-if="r.type===EnumDeviceType.USB"
                                            :device="r"/>
                                        <DeviceActionWifiOff
                                            v-if="r.type===EnumDeviceType.WIFI"
                                            :device="r"/>
                                        <DeviceActionMirrorCamera :device="r"/>
                                        <DeviceActionMirrorOTG
                                            v-if="r.type===EnumDeviceType.USB"
                                            :device="r"/>
                                        <a-doption @click="adbShellDialog?.show(r)">
                                            {{ $t('命令行') }}
                                        </a-doption>
                                        <a-doption v-if="rIndex>0" @click="deviceStore.doTop(rIndex)">
                                            {{ $t('置顶') }}
                                        </a-doption>
                                        <a-doption @click="settingDialog?.show(r)">
                                            {{ $t('设备设置') }}
                                        </a-doption>
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
    <DeviceSettingDialog ref="settingDialog"/>
    <DeviceFileManagerDialog ref="fileManagerDialog"/>
    <DeviceShellDialog ref="shellDialog"/>
    <DeviceAdbShellDialog ref="adbShellDialog"/>
</template>

<style scoped>
.pb-device-container {
    &.has-records {
        background-image: url("./../assets/image/device-bg.svg");
        background-size: 15rem 15rem;
        background-position: 98% 98%;
        background-blend-mode: lighten;
        background-color: rgba(255, 255, 255, 0.8);
        background-repeat: no-repeat;
    }
}
</style>
