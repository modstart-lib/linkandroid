<script setup lang="ts">
import {computed, onMounted, onUnmounted, ref} from 'vue'
import ListerTop from '../components/common/ListerTop.vue'
import {t} from '../lang'
import {Dialog} from '../lib/dialog'
import {mapError} from '../lib/error'
import {useDeviceStore} from '../store/modules/device'
import {EnumDeviceStatus} from '../types/Device'
import {testActionSet, testActionUnset} from '../utils/test'
import DeviceAdbShellDialog from './Device/DeviceAdbShellDialog.vue'
import DeviceCameraDialog from './Device/DeviceCameraDialog.vue'
import DeviceConnectWifiDialog from './Device/DeviceConnectWifiDialog.vue'
import DeviceDefaultSettingDialog from './Device/DeviceDefaultSettingDialog.vue'
import DeviceEmpty from './Device/DeviceEmpty.vue'
import DeviceFileManagerDialog from './Device/DeviceFileManagerDialog.vue'
import DeviceFilterEmpty from './Device/DeviceFilterEmpty.vue'
import DeviceGroupSelectDialog from './Device/DeviceGroupSelectDialog.vue'
import DeviceGroupSettingDialog from './Device/DeviceGroupSettingDialog.vue'
import DeviceItem from './Device/DeviceItem.vue'
import DevicePairingCodeDialog from './Device/DevicePairingCodeDialog.vue'
import DeviceSettingDialog from './Device/DeviceSettingDialog.vue'
import DeviceShellDialog from './Device/DeviceShellDialog.vue'
import DeviceWirelessPairingDialog from './Device/DeviceWirelessPairingDialog.vue'

const cameraDialog = ref<InstanceType<typeof DeviceCameraDialog> | null>(null)
const settingDialog = ref<InstanceType<typeof DeviceSettingDialog> | null>(null)
const fileManagerDialog = ref<InstanceType<typeof DeviceFileManagerDialog> | null>(null)
const shellDialog = ref<InstanceType<typeof DeviceShellDialog> | null>(null)
const adbShellDialog = ref<InstanceType<typeof DeviceAdbShellDialog> | null>(null)
const connectWifiDialog = ref<InstanceType<typeof DeviceConnectWifiDialog> | null>(null)
const wirelessPairingDialog = ref<InstanceType<typeof DeviceWirelessPairingDialog> | null>(null)
const pairingCodeDialog = ref<InstanceType<typeof DevicePairingCodeDialog> | null>(null)
const defaultSettingDialog = ref<InstanceType<typeof DeviceDefaultSettingDialog> | null>(null)
const groupSettingDialog = ref<InstanceType<typeof DeviceGroupSettingDialog> | null>(null)
const groupSelectDialog = ref<InstanceType<typeof DeviceGroupSelectDialog> | null>(null)

const deviceStore = useDeviceStore()

const searchKeywords = ref('')
const filterStatus = ref<string>('')
const filterGroupId = ref<string>('')
const loading = ref(false)

const selectedDeviceIds = ref<Set<string>>(new Set())
const batchActionType = ref<string>('')

const selectedCount = computed(() => selectedDeviceIds.value.size)

const isAllVisibleSelected = computed(() => {
    if (filterRecords.value.length === 0) return false
    return filterRecords.value.every((r) => selectedDeviceIds.value.has(r.id))
})

const toggleSelect = (deviceId: string) => {
    const newSet = new Set(selectedDeviceIds.value)
    if (newSet.has(deviceId)) {
        newSet.delete(deviceId)
    } else {
        newSet.add(deviceId)
    }
    selectedDeviceIds.value = newSet
    if (newSet.size === 0) {
        batchActionType.value = ''
    }
}

const doSelectAll = () => {
    const allVisibleSelected = filterRecords.value.every((r) => selectedDeviceIds.value.has(r.id))
    if (allVisibleSelected) {
        const newSet = new Set(selectedDeviceIds.value)
        filterRecords.value.forEach((r) => newSet.delete(r.id))
        selectedDeviceIds.value = newSet
    } else {
        const newSet = new Set(selectedDeviceIds.value)
        filterRecords.value.forEach((r) => newSet.add(r.id))
        selectedDeviceIds.value = newSet
    }
}

const doBatchAction = async (action: string) => {
    batchActionType.value = action
    const deviceIds = Array.from(selectedDeviceIds.value)
    if (deviceIds.length === 0) return
    if (action === 'install') {
        const path = await window.$mapi.file.openFile()
        if (path) {
            Dialog.loadingOn(t('device.installing'))
            try {
                for (const id of deviceIds) {
                    await window.$mapi.adb.install(id, path)
                }
                Dialog.tipSuccess(t('device.installSuccess'))
            } catch (e) {
                Dialog.tipError(mapError(e))
            } finally {
                Dialog.loadingOff()
            }
        }
        batchActionType.value = ''
    } else if (action === 'mirror') {
        for (const id of deviceIds) {
            const device = deviceStore.records.find((r) => r.id === id)
            if (device && device.status === EnumDeviceStatus.CONNECTED) {
                deviceStore.doMirror(device)
            }
        }
        batchActionType.value = ''
    }
}

const filterRecords = computed(() => {
    return deviceStore.records.filter((r) => {
        // Status filter
        if (filterStatus.value && r.status !== filterStatus.value) {
            return false
        }
        // Group filter
        if (filterGroupId.value) {
            const group = deviceStore.groups.find((g) => g.id === filterGroupId.value)
            if (!group || !group.deviceIds.includes(r.id)) {
                return false
            }
        }
        // Keyword search
        const keywords = searchKeywords.value.toLowerCase()
        if (keywords) {
            if (r.name?.toLowerCase().includes(keywords)) {
                return true
            }
            return false
        }
        return true
    })
})

const doRefresh = async () => {
    loading.value = true
    Dialog.loadingOn(t('device.refreshing'))
    try {
        await deviceStore.refresh()
        Dialog.tipSuccess(t('device.refreshSuccess'))
    } catch (e) {
        Dialog.tipError(mapError(e))
    } finally {
        loading.value = false
        Dialog.loadingOff()
    }
}

onMounted(() => {
    testActionSet('device.refresh', () => doRefresh())
    testActionSet('device.filterByGroup', (groupId: string) => {
        filterGroupId.value = groupId || ''
    })
    testActionSet('device.filterByStatus', (status: string) => {
        filterStatus.value = status || ''
    })
    testActionSet('device.toggleSelect', (deviceId: string) => toggleSelect(deviceId))
    testActionSet('device.selectAll', () => doSelectAll())
    testActionSet('device.batchAction', (action: string) => doBatchAction(action))
    testActionSet('device.getSelectedCount', () => selectedDeviceIds.value.size)
})

onUnmounted(() => {
    testActionUnset('device.refresh')
    testActionUnset('device.filterByGroup')
    testActionUnset('device.filterByStatus')
    testActionUnset('device.toggleSelect')
    testActionUnset('device.selectAll')
    testActionUnset('device.batchAction')
    testActionUnset('device.getSelectedCount')
})
</script>

<template>
    <div
        class="pb-device-container min-h-[calc(100vh-4rem)] relative select-none"
        :class="{'has-records': deviceStore.records.length > 0}"
    >
        <div class="pb-header flex items-center bg-white p-6">
            <div class="text-3xl font-bold flex-grow flex items-center gap-2">
                <i-lucide-smartphone />
                {{ $t('device.title') }}
            </div>
        </div>
        <div class="px-6 pb-6">
            <ListerTop v-if="deviceStore.records.length > 0" :loading="loading" @refresh="doRefresh">
                <!-- 全选按钮 - 独立组件，始终显示，状态与当前列表选中关联 -->
                <a-button
                    :disabled="filterRecords.length === 0"
                    @click="doSelectAll"
                    :aria-label="isAllVisibleSelected ? $t('common.deselectAll') : $t('common.selectAll')"
                >
                    <template #icon>
                        <i-lucide-check-square v-if="isAllVisibleSelected" />
                        <i-lucide-square v-else />
                    </template>
                </a-button>
                <!-- 全部状态 -->
                <a-select v-model="filterStatus" :placeholder="$t('device.allStatus')" class="w-32" allow-clear>
                    <a-option value="">{{ $t('device.allStatus') }}</a-option>
                    <a-option :value="EnumDeviceStatus.CONNECTED">{{ $t('device.statusConnected') }}</a-option>
                    <a-option :value="EnumDeviceStatus.WAIT_CONNECTING">{{ $t('device.statusConnecting') }}</a-option>
                    <a-option :value="EnumDeviceStatus.DISCONNECTED">{{ $t('device.statusDisconnected') }}</a-option>
                </a-select>
                <a-select v-model="filterGroupId" :placeholder="$t('device.groupFilter')" class="w-36" allow-clear>
                    <a-option value="">{{ $t('device.groupFilter') }}</a-option>
                    <a-option v-for="g in deviceStore.groups" :key="g.id" :value="g.id">{{ g.name }}</a-option>
                </a-select>
                <!-- 搜索设备 -->
                <a-input-search
                    v-model="searchKeywords"
                    :placeholder="$t('device.searchPlaceholder')"
                    class="w-48"
                    allow-clear
                />
                <!-- 批量操作 - 放在搜索设备后面 -->
                <a-dropdown @select="doBatchAction">
                    <a-button :disabled="selectedDeviceIds.size === 0">
                        <template #icon>
                            <i-lucide-layers />
                        </template>
                        {{ $t('device.batchOperation', {count: selectedCount}) }}
                    </a-button>
                    <template #content>
                        <a-doption value="install">
                            <template #icon>
                                <i-lucide-package />
                            </template>
                            {{ $t('device.installApp') }}
                        </a-doption>
                        <a-doption value="mirror">
                            <template #icon>
                                <i-lucide-monitor />
                            </template>
                            {{ $t('device.mirrorToComputer') }}
                        </a-doption>
                    </template>
                </a-dropdown>
                <template #actions>
                    <a-dropdown trigger="hover">
                        <a-button>
                            <template #icon>
                                <i-lucide-link />
                            </template>
                            {{ $t('device.connect') }}
                        </a-button>
                        <template #content>
                            <a-doption @click="connectWifiDialog?.show()">
                                <template #icon>
                                    <i-lucide-link />
                                </template>
                                {{ $t('device.connectNetwork') }}
                            </a-doption>
                            <a-doption @click="wirelessPairingDialog?.show()">
                                <template #icon>
                                    <i-lucide-qr-code />
                                </template>
                                {{ $t('device.wirelessPairing') }}
                            </a-doption>
                            <a-doption @click="pairingCodeDialog?.show()">
                                <template #icon>
                                    <i-lucide-shield />
                                </template>
                                {{ $t('device.pairingCodePairing') }}
                            </a-doption>
                        </template>
                    </a-dropdown>
                    <a-dropdown trigger="hover">
                        <a-button>
                            <template #icon>
                                <i-lucide-chevron-down />
                            </template>
                        </a-button>
                        <template #content>
                            <a-doption @click="groupSettingDialog?.show()">{{ $t('device.groupSettings') }}</a-doption>
                            <a-doption @click="shellDialog?.show()">{{ $t('device.commandLineTool') }}</a-doption>
                            <a-doption @click="defaultSettingDialog?.show()">{{
                                $t('device.defaultSettings')
                            }}</a-doption>
                        </template>
                    </a-dropdown>
                </template>
            </ListerTop>
            <DeviceEmpty v-if="!deviceStore.records.length" />
            <DeviceFilterEmpty v-else-if="!filterRecords.length" />
            <div v-else class="grid gap-1 grid-cols-[repeat(auto-fill,minmax(13rem,1fr))]">
                <div v-for="(r, rIndex) in filterRecords" :key="rIndex">
                    <DeviceItem
                        :record="r"
                        :selected="selectedDeviceIds.has(r.id)"
                        @toggle="toggleSelect(r.id)"
                        @file-manager="fileManagerDialog?.show(r)"
                        @setting="settingDialog?.show(r)"
                        @adb-shell="adbShellDialog?.show(r)"
                        @camera="cameraDialog?.show(r)"
                        @group-select="groupSelectDialog?.show(r.id)"
                    />
                </div>
            </div>
        </div>
    </div>
    <DeviceConnectWifiDialog ref="connectWifiDialog" @update="doRefresh" />
    <DeviceWirelessPairingDialog ref="wirelessPairingDialog" @update="doRefresh" />
    <DevicePairingCodeDialog ref="pairingCodeDialog" @update="doRefresh" />
    <DeviceCameraDialog ref="cameraDialog" />
    <DeviceSettingDialog ref="settingDialog" />
    <DeviceFileManagerDialog ref="fileManagerDialog" />
    <DeviceAdbShellDialog ref="adbShellDialog" />
    <DeviceShellDialog ref="shellDialog" />
    <DeviceDefaultSettingDialog ref="defaultSettingDialog" />
    <DeviceGroupSettingDialog ref="groupSettingDialog" />
    <DeviceGroupSelectDialog ref="groupSelectDialog" />
</template>

<style scoped lang="less">
[data-theme='dark'] {
    .pb-device-container {
        background-color: var(--color-background);

        .pb-header {
            background-color: var(--color-background);
        }
    }
}
</style>
