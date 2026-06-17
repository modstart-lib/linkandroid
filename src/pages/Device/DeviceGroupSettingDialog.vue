<script setup lang="ts">
import {cloneDeep} from 'lodash-es'
import {onMounted, onUnmounted, ref} from 'vue'
import {t} from '../../lang'
import {testActionSet, testActionUnset} from '../../utils/test'
import {Dialog} from '../../lib/dialog'
import {useDeviceStore} from '../../store/modules/device'
import type {DeviceGroup} from '../../types/Device'
const visible = ref(false)
const saving = ref(false)
const draftGroups = ref<DeviceGroup[]>([])

const deviceStore = useDeviceStore()

const show = () => {
    draftGroups.value = cloneDeep(deviceStore.groups)
    visible.value = true
}

onMounted(() => {
    testActionSet('device.groupSetting.show', () => show())
})

onUnmounted(() => {
    testActionUnset('device.groupSetting.show')
})

defineExpose({show})

const doAddGroup = () => {
    const id = 'group_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)
    draftGroups.value.push({id, name: t('device.newGroup'), deviceIds: []})
}

const doDeleteGroup = (group: DeviceGroup) => {
    const idx = draftGroups.value.findIndex((g) => g.id === group.id)
    if (idx !== -1) draftGroups.value.splice(idx, 1)
}

const doMoveUp = (idx: number) => {
    if (idx <= 0) return
    const tmp = draftGroups.value[idx]
    draftGroups.value[idx] = draftGroups.value[idx - 1]
    draftGroups.value[idx - 1] = tmp
}

const doMoveDown = (idx: number) => {
    if (idx >= draftGroups.value.length - 1) return
    const tmp = draftGroups.value[idx]
    draftGroups.value[idx] = draftGroups.value[idx + 1]
    draftGroups.value[idx + 1] = tmp
}

const doSave = async () => {
    saving.value = true
    try {
        deviceStore.groups.splice(0, deviceStore.groups.length, ...cloneDeep(draftGroups.value))
        await deviceStore.syncGroups()
        visible.value = false
        Dialog.tipSuccess(t('device.groupsSaved'))
    } catch (e) {
        Dialog.tipError(t('device.groupsSaveFailed'))
    } finally {
        saving.value = false
    }
}
</script>

<template>
    <a-modal
        v-model:visible="visible"
        width="min(600px, 90vw)"
        :footer="false"
        title-align="start"
        @cancel="visible = false"
    >
        <template #title>
            <div class="font-bold">{{ $t('device.groupSettings') }}</div>
        </template>
        <div style="height: calc(100vh - 16rem)" class="flex flex-col">
            <div class="flex-grow overflow-y-auto">
                <div v-if="draftGroups.length === 0" class="text-gray-400 text-center py-8">
                    {{ $t('device.noGroups') }}
                </div>
                <!-- Table header -->
                <div
                    v-if="draftGroups.length > 0"
                    class="flex items-center gap-2 px-3 py-2 text-xs text-gray-400 border-b border-solid border-gray-200 dark:border-gray-700"
                >
                    <div class="flex-1">{{ $t('device.groupName') }}</div>
                    <div class="w-32 text-center">{{ $t('device.actions') }}</div>
                </div>
                <!-- Table rows -->
                <div
                    v-for="(group, idx) in draftGroups"
                    :key="group.id"
                    class="flex items-center gap-2 px-3 py-2 border-b border-solid border-gray-100 dark:border-gray-700"
                >
                    <div class="flex-1">
                        <a-input v-model="group.name" />
                    </div>
                    <div class="w-32 flex items-center justify-center gap-1">
                        <a-button type="text" class="text-red-500" @click="doDeleteGroup(group)">
                            <template #icon><i-lucide-trash-2 /></template>
                        </a-button>
                        <a-button type="text" :disabled="idx === 0" @click="doMoveUp(idx)">
                            <template #icon><i-lucide-chevron-up /></template>
                        </a-button>
                        <a-button type="text" :disabled="idx === draftGroups.length - 1" @click="doMoveDown(idx)">
                            <template #icon><i-lucide-chevron-down /></template>
                        </a-button>
                    </div>
                </div>
            </div>
            <div class="flex-shrink-0 pt-3 border-t border-solid border-gray-100 dark:border-gray-800 mt-3 space-y-3">
                <div class="flex justify-center">
                    <a-button long @click="doAddGroup">
                        <template #icon><i-lucide-plus /></template>
                        {{ $t('device.addGroup') }}
                    </a-button>
                </div>
                <div class="flex justify-end gap-2">
                    <a-button @click="visible = false">{{ $t('common.cancel') }}</a-button>
                    <a-button type="primary" :loading="saving" @click="doSave">{{ $t('common.save') }}</a-button>
                </div>
            </div>
        </div>
    </a-modal>
</template>
