<script setup lang="ts">
import {computed, ref} from 'vue'
import InputInlineEditor from '../../components/common/InputInlineEditor.vue'
import {t} from '../../lang'
import {Dialog} from '../../lib/dialog'
import {mapError} from '../../lib/error'
import {parseIPPort} from '../../lib/linkandroid'
import {useDeviceStore} from '../../store/modules/device'
import {DeviceRecord, EnumDeviceStatus, EnumDeviceType} from '../../types/Device'
import DeviceActionApp from './DeviceActionApp.vue'
import DeviceActionConnect from './DeviceActionConnect.vue'
import DeviceActionDisconnect from './DeviceActionDisconnect.vue'
import DeviceActionMirror from './DeviceActionMirror.vue'
import DeviceActionMirrorCamera from './DeviceActionMirrorCamera.vue'
import DeviceActionMirrorOTG from './DeviceActionMirrorOTG.vue'
import DeviceActionRecord from './DeviceActionRecord.vue'
import DeviceActionScreenshot from './DeviceActionScreenshot.vue'
import DeviceActionWifiOff from './DeviceActionWifiOff.vue'
import DeviceActionWifiOn from './DeviceActionWifiOn.vue'
import DeviceStatus from './DeviceStatus.vue'
import DeviceType from './DeviceType.vue'

const props = defineProps<{
    record: DeviceRecord
    selected?: boolean
}>()

const emit = defineEmits<{
    (e: 'toggle'): void
    (e: 'setting'): void
    (e: 'file-manager'): void
    (e: 'adbShell'): void
    (e: 'camera'): void
    (e: 'group-select'): void
}>()

const actionMirror = ref<InstanceType<typeof DeviceActionMirror> | null>(null)

const deviceStore = useDeviceStore()

const rIndex = computed(() => {
    return deviceStore.records.findIndex((r) => r.id === props.record.id)
})

const deviceIP = computed(() => {
    if (props.record.type !== EnumDeviceType.WIFI) return ''
    const parsed = parseIPPort(props.record.id)
    return parsed.ip
})

const deviceGroups = computed(() => {
    return deviceStore.groups.filter((g) => g.deviceIds.includes(props.record.id))
})

const doDelete = async (device: DeviceRecord) => {
    Dialog.confirm(t('device.deleteConfirm')).then(async () => {
        Dialog.loadingOn(t('device.deleting'))
        try {
            await deviceStore.delete(device)
            Dialog.tipSuccess(t('device.deleteSuccess'))
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
        Dialog.tipSuccess(t('device.editSuccess'))
    } catch (e) {
        Dialog.tipError(mapError(e))
    }
}
</script>

<template>
    <div
        class="hover:shadow-lg bg-white dark:bg-gray-800 shadow border border-solid rounded-lg flex flex-col p-1 cursor-pointer"
        :class="
            selected
                ? 'border-[var(--color-primary)] ring-2 ring-[rgb(var(--primary-2))] dark:ring-[rgb(var(--primary-8))]'
                : 'border-gray-100 dark:border-gray-800'
        "
        @click="emit('toggle')"
    >
        <div class="flex items-center gap-1 h-8 px-1">
            <i-lucide-check-circle v-if="selected" class="text-[var(--color-primary)] w-3.5 h-3.5 flex-shrink-0" />
            <i-lucide-circle v-else class="text-gray-300 w-3.5 h-3.5 flex-shrink-0" />
            <DeviceType :type="record.type" />
            <div class="flex-1 flex items-center gap-1 group min-w-0">
                <span class="truncate text-sm font-medium leading-6">{{ record.name }}</span>
                <InputInlineEditor :value="record.name" @change="onEditName(record, $event)">
                    <a
                        class="text-gray-400 hover:text-gray-600 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        href="javascript:;"
                    >
                        <i-lucide-pencil />
                    </a>
                </InputInlineEditor>
            </div>
            <div class="flex-shrink-0">
                <DeviceStatus :status="record.status" />
            </div>
        </div>
        <div class="flex">
            <div class="flex-grow">
                <a-tooltip :content="$t('device.mirrorToComputer')">
                    <div
                        @click.stop="actionMirror?.start()"
                        class="h-64 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center"
                    >
                        <div
                            class="cursor-pointer border-4 overflow-hidden border-solid border-black bg-black rounded-lg shadow-2xl"
                        >
                            <div v-if="record.screenshot && record.runtime?.previewImage === 'yes'">
                                <img :src="record.screenshot" class="max-h-60 max-w-36 rounded-sm" />
                            </div>
                            <div v-else class="w-32 h-60 bg-gray-200 text-xs text-gray-300 flex rounded-sm">
                                <div class="m-auto">
                                    <i-lucide-eye class="text-2xl" />
                                </div>
                            </div>
                        </div>
                    </div>
                </a-tooltip>
            </div>
            <div class="flex-shrink-0 flex flex-col p-0 gap-1 w-9" @click.stop>
                <DeviceActionMirror ref="actionMirror" :device="record" />
                <DeviceActionApp :device="record" />
                <DeviceActionScreenshot :device="record" />
                <DeviceActionRecord :device="record" />
                <a-tooltip :content="$t('device.fileManager')">
                    <a-button class="ml-1" @click="emit('file-manager')">
                        <template #icon>
                            <i-lucide-folder class="text-gray-400" />
                        </template>
                    </a-button>
                </a-tooltip>
                <a-dropdown trigger="hover" :popup-max-height="false">
                    <a-button class="ml-1">
                        <template #icon>
                            <i-lucide-settings class="text-gray-400" />
                        </template>
                    </a-button>
                    <template #content>
                        <DeviceActionDisconnect
                            v-if="record.type === EnumDeviceType.WIFI && record.status === EnumDeviceStatus.CONNECTED"
                            :device="record"
                        />
                        <DeviceActionConnect
                            v-if="
                                record.type === EnumDeviceType.WIFI && record.status === EnumDeviceStatus.DISCONNECTED
                            "
                            :device="record"
                        />
                        <DeviceActionWifiOn v-if="record.type === EnumDeviceType.USB" :device="record" />
                        <DeviceActionWifiOff v-if="record.type === EnumDeviceType.WIFI" :device="record" />
                        <DeviceActionMirrorCamera :device="record" @camera="emit('camera')" />
                        <DeviceActionMirrorOTG v-if="record.type === EnumDeviceType.USB" :device="record" />
                        <a-doption @click="emit('adbShell')">
                            {{ $t('device.commandLine') }}
                        </a-doption>
                        <a-doption v-if="rIndex > 0" @click="deviceStore.doTop(rIndex)">
                            {{ $t('device.pinTop') }}
                        </a-doption>
                        <a-doption @click="emit('setting')">
                            {{ $t('device.settings') }}
                        </a-doption>
                        <a-doption v-if="record.status === EnumDeviceStatus.DISCONNECTED" @click="doDelete(record)">
                            {{ $t('device.delete') }}
                        </a-doption>
                    </template>
                </a-dropdown>
            </div>
        </div>
        <div class="flex items-center gap-3 px-1 h-6 text-xs text-gray-400">
            <div v-if="record.type === EnumDeviceType.WIFI && deviceIP" class="flex items-center gap-1">
                <i-mdi-ip-network class="w-3.5 h-3.5" aria-hidden="true" />
                <span>{{ deviceIP }}</span>
            </div>
            <div class="flex items-center gap-1 cursor-pointer hover:text-blue-500" @click.stop="emit('group-select')">
                <template v-if="deviceGroups.length > 0">
                    <div v-for="g in deviceGroups" :key="g.id" class="flex items-center gap-1">
                        <i-mdi-folder-outline class="w-3.5 h-3.5" aria-hidden="true" />
                        <span>{{ g.name }}</span>
                    </div>
                </template>
                <div v-else class="flex items-center gap-1">
                    <i-mdi-folder-outline class="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{{ $t('device.ungrouped') }}</span>
                </div>
            </div>
        </div>
    </div>
</template>
