<script setup lang="ts">
import {computed, onMounted, onUnmounted, ref} from 'vue'
import {testActionSet, testActionUnset} from '../../utils/test'
import SettingItemYesNoDefault from '../../components/common/SettingItemYesNoDefault.vue'
import {t} from '../../lang'
import {useDeviceStore} from '../../store/modules/device'
import {DeviceRecord} from '../../types/Device'

const deviceStore = useDeviceStore()
const visible = ref(false)
const formData = ref({
    dimWhenMirror: '',
    alwaysTop: '',
    mirrorSound: '',
    previewImage: '',
    videoBitRate: '',
    maxFps: '',
    scrcpyArgs: '',
    panelShow: '',
    powerSaveBlock: '',
    windowBorderless: '',
})

const bitratePresets = ['2M', '4M', '6M', '8M', '10M', '12M', '16M', '20M', '40M', '50M']
const fpsPresets = ['30', '60', '90', '120', '144', '240']

const videoBitRateOptions = computed(() => {
    const current = formData.value.videoBitRate
    const presets = bitratePresets.map((v) => ({label: v, value: v}))
    if (current && !bitratePresets.includes(current)) {
        presets.unshift({label: `${current} (${t('common.custom')})`, value: current})
    }
    return [{label: t('device.emptyConfigPlaceholder'), value: ''}, ...presets]
})

const maxFpsOptions = computed(() => {
    const current = formData.value.maxFps
    const presets = fpsPresets.map((v) => ({label: v, value: v}))
    if (current && !fpsPresets.includes(current)) {
        presets.unshift({label: `${current} (${t('common.custom')})`, value: current})
    }
    return [{label: t('device.emptyConfigPlaceholder'), value: ''}, ...presets]
})
const device = ref<DeviceRecord | null>(null)
const infoColumns = [
    {
        title: t('device.fieldName'),
        dataIndex: 'name',
        width: 200,
    },
    {
        title: t('device.fieldValue'),
        dataIndex: 'value',
    },
]

const deviceDataInfo = computed(() => {
    return Object.entries(device.value?.raw || {}).map(([name, value]) => {
        return {name, value}
    })
})
const show = (record: DeviceRecord) => {
    device.value = record
    formData.value.dimWhenMirror = record.setting?.dimWhenMirror || ''
    formData.value.alwaysTop = record.setting?.alwaysTop || ''
    formData.value.mirrorSound = record.setting?.mirrorSound || ''
    formData.value.previewImage = record.setting?.previewImage || ''
    formData.value.videoBitRate = record.setting?.videoBitRate || ''
    formData.value.maxFps = record.setting?.maxFps || ''
    formData.value.scrcpyArgs = record.setting?.scrcpyArgs || ''
    formData.value.panelShow = record.setting?.panelShow || ''
    formData.value.powerSaveBlock = record.setting?.powerSaveBlock || ''
    formData.value.windowBorderless = record.setting?.windowBorderless || ''
    visible.value = true
}

const doSubmit = async () => {
    await deviceStore.updateSetting(device.value!.id, {
        dimWhenMirror: formData.value.dimWhenMirror,
        alwaysTop: formData.value.alwaysTop,
        mirrorSound: formData.value.mirrorSound,
        previewImage: formData.value.previewImage,
        videoBitRate: formData.value.videoBitRate,
        maxFps: formData.value.maxFps,
        scrcpyArgs: formData.value.scrcpyArgs,
        panelShow: formData.value.panelShow,
        powerSaveBlock: formData.value.powerSaveBlock,
        windowBorderless: formData.value.windowBorderless,
    })
    visible.value = false
}

const fillForm = (data: Partial<typeof formData.value>) => {
    formData.value = {...formData.value, ...data}
}

onMounted(() => {
    testActionSet('device.setting.show', (data: any) => {
        const deviceId = data?.deviceId
        const record = deviceId ? deviceStore.records.find((r) => r.id === deviceId) : deviceStore.records[0]
        if (record) show(record)
    })
    testActionSet('device.setting.fill', (data: any) => fillForm(data))
    testActionSet('device.setting.submit', () => doSubmit())
})

onUnmounted(() => {
    testActionUnset('device.setting.show')
    testActionUnset('device.setting.fill')
    testActionUnset('device.setting.submit')
})

defineExpose({
    show,
    fillForm,
    doSubmit,
})
</script>

<template>
    <a-modal v-model:visible="visible" width="40rem" title-align="start">
        <template #title>
            <i-lucide-smartphone />
            {{ $t('device.settingsFor') }} {{ device?.id }}
        </template>
        <template #footer>
            <a-button type="primary" @click="doSubmit">
                {{ $t('common.save') }}
            </a-button>
        </template>
        <div v-if="visible" class="-mx-5 -my-6">
            <div class="overflow-y-auto p-5" style="height: calc(80vh - 200px)">
                <div>
                    <div class="font-bold text-xl mb-3">
                        {{ $t('device.title') }}
                    </div>
                    <div class="flex mb-3">
                        <div class="flex-grow">{{ $t('device.dimWhenMirror') }}</div>
                        <div class="">
                            <SettingItemYesNoDefault v-model="formData.dimWhenMirror" />
                        </div>
                    </div>
                    <div class="flex mb-3">
                        <div class="flex-grow">{{ $t('device.alwaysTop') }}</div>
                        <div class="">
                            <SettingItemYesNoDefault v-model="formData.alwaysTop" />
                        </div>
                    </div>
                    <div class="flex mb-3">
                        <div class="flex-grow">{{ $t('device.mirrorSound') }}</div>
                        <div class="">
                            <SettingItemYesNoDefault v-model="formData.mirrorSound" />
                        </div>
                    </div>
                    <div class="flex mb-3">
                        <div class="flex-grow">{{ $t('device.previewImage') }}</div>
                        <div class="">
                            <SettingItemYesNoDefault v-model="formData.previewImage" />
                        </div>
                    </div>
                    <div class="flex mb-3">
                        <div class="flex-grow">{{ $t('device.panelShow') }}</div>
                        <div class="">
                            <SettingItemYesNoDefault v-model="formData.panelShow" />
                        </div>
                    </div>
                    <div class="flex mb-3">
                        <div class="flex-grow">{{ $t('device.powerSaveBlock') }}</div>
                        <div class="">
                            <SettingItemYesNoDefault v-model="formData.powerSaveBlock" />
                        </div>
                    </div>
                    <div class="flex mb-3">
                        <div class="flex-grow">{{ $t('device.windowBorderless') }}</div>
                        <div class="">
                            <SettingItemYesNoDefault v-model="formData.windowBorderless" />
                        </div>
                    </div>
                    <div class="flex mb-3">
                        <div class="flex-grow">
                            <div>{{ $t('device.videoBitRate') }}</div>
                            <div class="text-gray-400 text-xs">{{ $t('device.videoBitRateHint') }}</div>
                        </div>
                        <div class="">
                            <a-select
                                v-model="formData.videoBitRate"
                                style="width: 16rem"
                                size="small"
                                allow-search
                                :options="videoBitRateOptions"
                                :placeholder="$t('device.emptyConfigPlaceholder')"
                            />
                        </div>
                    </div>
                    <div class="flex mb-3">
                        <div class="flex-grow">{{ $t('device.maxFps') }}</div>
                        <div class="">
                            <a-select
                                v-model="formData.maxFps"
                                style="width: 16rem"
                                size="small"
                                allow-search
                                :options="maxFpsOptions"
                                :placeholder="$t('device.emptyConfigPlaceholder')"
                            />
                        </div>
                    </div>
                    <div class="flex mb-3">
                        <div class="flex-grow">
                            <div>{{ $t('device.customArgs') }}</div>
                            <div class="text-gray-400 text-xs">{{ $t('device.customArgsHint') }}</div>
                        </div>
                        <div class="">
                            <a-input
                                v-model="formData.scrcpyArgs"
                                size="small"
                                :placeholder="'--lock-video-orientation=0 --crop 720:1280:0:0'"
                            />
                        </div>
                    </div>
                    <div class="font-bold text-xl mb-3">
                        {{ $t('device.other') }}
                    </div>
                    <div class="w-full">
                        <a-table
                            :columns="infoColumns"
                            size="small"
                            width="100%"
                            :data="deviceDataInfo"
                            :pagination="false"
                        />
                    </div>
                </div>
            </div>
        </div>
    </a-modal>
</template>
