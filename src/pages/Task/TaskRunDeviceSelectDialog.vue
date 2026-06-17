<script setup lang="ts">
import {computed, onMounted, onUnmounted, ref} from 'vue'
import {useDeviceStore} from '../../store/modules/device'
import ListerTop from '../../components/common/ListerTop.vue'
import CronEditor from '../../components/common/CronEditor.vue'
import {testActionSet, testActionUnset} from '../../utils/test'

export interface RunDeviceConfig {
    runMode: 'manual' | 'scheduled'
    cronExpression: string
    runOnAllDevices: boolean
    deviceIds: string[]
}

const visible = ref(false)
const deviceStore = useDeviceStore()
const searchKeywords = ref('')
const filterType = ref<string>('')

// Form fields
const runMode = ref<'manual' | 'scheduled'>('manual')
const cronExpression = ref('')
const selectedDeviceIds = ref<string[]>([])
const runOnAllDevices = ref(false)

const filterRecords = computed(() => {
    let records = deviceStore.records
    if (filterType.value) {
        records = records.filter((d) => d.type === filterType.value)
    }
    if (searchKeywords.value) {
        const kw = searchKeywords.value.toLowerCase()
        records = records.filter((d) => {
            const name = d.name || d.raw?.model || d.id
            return name.toLowerCase().includes(kw)
        })
    }
    return records
})

const allFilteredSelected = computed(() => {
    if (filterRecords.value.length === 0) return false
    return filterRecords.value.every((d) => selectedDeviceIds.value.includes(d.id))
})

const toggleSelectAll = () => {
    const filteredIds = new Set(filterRecords.value.map((d) => d.id))
    if (allFilteredSelected.value) {
        selectedDeviceIds.value = selectedDeviceIds.value.filter((id) => !filteredIds.has(id))
    } else {
        selectedDeviceIds.value = [...new Set([...selectedDeviceIds.value, ...filteredIds])]
    }
}

const show = (config?: Partial<RunDeviceConfig>) => {
    runMode.value = config?.runMode || 'manual'
    cronExpression.value = config?.cronExpression || ''
    runOnAllDevices.value = config?.runOnAllDevices || false
    selectedDeviceIds.value = config?.deviceIds ? [...config.deviceIds] : []
    searchKeywords.value = ''
    filterType.value = ''
    visible.value = true
}

const emit = defineEmits<{
    (e: 'confirm', config: RunDeviceConfig): void
}>()

const doConfirm = () => {
    emit('confirm', {
        runMode: runMode.value,
        cronExpression: cronExpression.value,
        runOnAllDevices: runOnAllDevices.value,
        deviceIds: [...selectedDeviceIds.value],
    })
    visible.value = false
}

const doToggleDevice = (deviceId: string) => {
    const idx = selectedDeviceIds.value.indexOf(deviceId)
    if (idx === -1) {
        selectedDeviceIds.value.push(deviceId)
    } else {
        selectedDeviceIds.value.splice(idx, 1)
    }
}

onMounted(() => {
    testActionSet('task.deviceSelect.toggleSelectAll', () => toggleSelectAll())
    testActionSet('task.deviceSelect.getSelectedCount', () => selectedDeviceIds.value.length)
    testActionSet('task.deviceSelect.getDeviceCount', () => filterRecords.value.length)
})

onUnmounted(() => {
    testActionUnset('task.deviceSelect.toggleSelectAll')
    testActionUnset('task.deviceSelect.getSelectedCount')
    testActionUnset('task.deviceSelect.getDeviceCount')
})

defineExpose({show})
</script>

<template>
    <a-modal v-model:visible="visible" width="min(620px, 95vw)" :footer="false" title-align="start">
        <template #title>
            <div class="font-bold">
                {{ $t('task.runDeviceSettingsTitle') }}
            </div>
        </template>
        <div class="-mx-5 -my-6">
            <div class="p-5 space-y-5">
                <!-- Run mode -->
                <div>
                    <div class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {{ $t('task.runMode') }}
                    </div>
                    <a-radio-group v-model="runMode" type="button">
                        <a-radio value="manual">{{ $t('task.runModeManual') }}</a-radio>
                        <a-radio value="scheduled">{{ $t('task.runModeScheduled') }}</a-radio>
                    </a-radio-group>
                </div>

                <!-- Cron expression (visible when scheduled) -->
                <div v-if="runMode === 'scheduled'">
                    <div class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {{ $t('task.cronExpression') }}
                    </div>
                    <CronEditor v-model="cronExpression" />
                </div>

                <!-- Device selection -->
                <div>
                    <div class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {{ $t('task.runDevices') }}
                    </div>
                    <ListerTop>
                        <a-checkbox :checked="allFilteredSelected" @change="toggleSelectAll">
                            {{ $t('common.selectAll') }}
                        </a-checkbox>
                        <a-select v-model="filterType" :placeholder="$t('device.groupFilter')" class="w-28" allow-clear>
                            <a-option value="usb">USB</a-option>
                            <a-option value="wifi">WiFi</a-option>
                        </a-select>
                        <a-input-search
                            v-model="searchKeywords"
                            :placeholder="$t('device.searchPlaceholder')"
                            class="w-48"
                            allow-clear
                        />
                    </ListerTop>
                    <div class="overflow-y-auto mt-3" style="max-height: calc(50vh - 200px)">
                        <div v-if="filterRecords.length === 0" class="py-8 text-center text-gray-400">
                            {{ $t('device.empty') }}
                        </div>
                        <div v-else class="space-y-1">
                            <div
                                v-for="d in filterRecords"
                                :key="d.id"
                                class="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
                                :class="{'bg-blue-50 dark:bg-blue-900/20': selectedDeviceIds.includes(d.id)}"
                                @click="doToggleDevice(d.id)"
                            >
                                <a-checkbox
                                    :checked="selectedDeviceIds.includes(d.id)"
                                    @click.stop="doToggleDevice(d.id)"
                                />
                                <div class="flex items-center gap-2 flex-1 min-w-0">
                                    <a-avatar :size="24" shape="square">
                                        <template #trigger-icon>
                                            <i-mdi-android v-if="d.type === 'usb'" class="text-green-500" />
                                            <i-mdi-wifi v-else class="text-blue-500" />
                                        </template>
                                    </a-avatar>
                                    <div class="truncate font-medium text-sm">
                                        {{ d.name || d.raw?.model || d.id }}
                                    </div>
                                </div>
                                <div class="text-xs text-gray-400 shrink-0">
                                    {{ d.type === 'usb' ? 'USB' : 'WiFi' }}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- All devices toggle -->
                <div class="flex items-center gap-2">
                    <a-checkbox v-model="runOnAllDevices">
                        {{ $t('task.runOnAllDevices') }}
                    </a-checkbox>
                    <a-tooltip :content="$t('task.runOnAllDevicesInfo')">
                        <i-lucide-info class="text-gray-400 text-sm cursor-help" />
                    </a-tooltip>
                </div>
            </div>
        </div>
        <template #footer>
            <div class="flex justify-end gap-2 items-center">
                <div class="text-xs text-gray-400 mr-auto">
                    {{ $t('task.runDevices') }}: {{ runOnAllDevices ? $t('common.all') : selectedDeviceIds.length }}
                </div>
                <a-button @click="visible = false">{{ $t('common.cancel') }}</a-button>
                <a-button type="primary" @click="doConfirm">{{ $t('common.confirm') }}</a-button>
            </div>
        </template>
    </a-modal>
</template>
