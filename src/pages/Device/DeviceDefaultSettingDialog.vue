<script setup lang="ts">
import {computed, onMounted, onUnmounted, ref} from 'vue'
import {testActionSet, testActionUnset} from '../../utils/test'
import SettingItemYesNo from '../../components/common/SettingItemYesNo.vue'
import {useSettingStore} from '../../store/modules/setting'

const setting = useSettingStore()
const visible = ref(false)
const formData = ref({
    dimWhenMirror: '',
    alwaysTop: '',
    mirrorSound: '',
    previewImage: '',
    panelShow: '',
    powerSaveBlock: '',
    windowBorderless: '',
})

const bitrateOptions = [
    {label: '2M', value: '2M'},
    {label: '4M', value: '4M'},
    {label: '6M', value: '6M'},
    {label: '8M', value: '8M'},
    {label: '10M', value: '10M'},
    {label: '12M', value: '12M'},
    {label: '16M', value: '16M'},
    {label: '20M', value: '20M'},
    {label: '40M', value: '40M'},
    {label: '50M', value: '50M'},
]

const fpsOptions = [
    {label: '30', value: '30'},
    {label: '60', value: '60'},
    {label: '90', value: '90'},
    {label: '120', value: '120'},
    {label: '144', value: '144'},
    {label: '240', value: '240'},
]

const bitrateValue = computed(() => {
    const v = setting.configGet('Device.videoBitRate', '8M').value
    return bitrateOptions.some((o) => o.value === v) ? v : '__custom__'
})

const fpsValue = computed(() => {
    const v = setting.configGet('Device.maxFps', '60').value
    return fpsOptions.some((o) => o.value === v) ? v : '__custom__'
})
const show = async () => {
    formData.value.dimWhenMirror = setting.configGet('Device.dimWhenMirror', 'no').value
    formData.value.alwaysTop = setting.configGet('Device.alwaysTop', 'no').value
    formData.value.mirrorSound = setting.configGet('Device.mirrorSound', 'no').value
    formData.value.previewImage = setting.configGet('Device.previewImage', 'no').value
    formData.value.panelShow = setting.configGet('Device.panelShow', 'no').value
    formData.value.powerSaveBlock = setting.configGet('Device.powerSaveBlock', 'yes').value
    formData.value.windowBorderless = setting.configGet('Device.windowBorderless', 'no').value
    visible.value = true
}

const doSubmit = async () => {
    await setting.setConfig('Device.dimWhenMirror', formData.value.dimWhenMirror)
    await setting.setConfig('Device.alwaysTop', formData.value.alwaysTop)
    await setting.setConfig('Device.mirrorSound', formData.value.mirrorSound)
    await setting.setConfig('Device.previewImage', formData.value.previewImage)
    await setting.setConfig('Device.panelShow', formData.value.panelShow)
    await setting.setConfig('Device.powerSaveBlock', formData.value.powerSaveBlock)
    await setting.setConfig('Device.windowBorderless', formData.value.windowBorderless)
    visible.value = false
}

const fillForm = (data: Partial<typeof formData.value>) => {
    formData.value = {...formData.value, ...data}
}

onMounted(() => {
    testActionSet('device.defaultSetting.show', () => show())
    testActionSet('device.defaultSetting.fill', (data: any) => fillForm(data))
    testActionSet('device.defaultSetting.submit', () => doSubmit())
})

onUnmounted(() => {
    testActionUnset('device.defaultSetting.show')
    testActionUnset('device.defaultSetting.fill')
    testActionUnset('device.defaultSetting.submit')
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
            {{ $t('device.defaultSettings') }}
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
                            <SettingItemYesNo v-model="formData.dimWhenMirror" />
                        </div>
                    </div>
                    <div class="flex mb-3">
                        <div class="flex-grow">{{ $t('device.alwaysTop') }}</div>
                        <div class="">
                            <SettingItemYesNo v-model="formData.alwaysTop" />
                        </div>
                    </div>
                    <div class="flex mb-3">
                        <div class="flex-grow">{{ $t('device.mirrorSound') }}</div>
                        <div class="">
                            <SettingItemYesNo v-model="formData.mirrorSound" />
                        </div>
                    </div>
                    <div class="flex mb-3">
                        <div class="flex-grow">{{ $t('device.previewImage') }}</div>
                        <div class="">
                            <SettingItemYesNo v-model="formData.previewImage" />
                        </div>
                    </div>
                    <div class="flex mb-3">
                        <div class="flex-grow">{{ $t('device.panelShow') }}</div>
                        <div class="">
                            <SettingItemYesNo v-model="formData.panelShow" />
                        </div>
                    </div>
                    <div class="flex mb-3">
                        <div class="flex-grow">{{ $t('device.powerSaveBlock') }}</div>
                        <div class="">
                            <SettingItemYesNo v-model="formData.powerSaveBlock" />
                        </div>
                    </div>
                    <div class="flex mb-3">
                        <div class="flex-grow">{{ $t('device.windowBorderless') }}</div>
                        <div class="">
                            <SettingItemYesNo v-model="formData.windowBorderless" />
                        </div>
                    </div>
                    <div class="flex mb-3">
                        <div class="flex-grow">
                            <div>{{ $t('device.videoBitRate') }}</div>
                            <div class="text-gray-400 text-xs">{{ $t('device.videoBitRateHint') }}</div>
                        </div>
                        <div class="">
                            <a-select
                                :model-value="bitrateValue.value"
                                style="width: 10rem"
                                size="small"
                                allow-search
                                :options="bitrateOptions"
                                @change="
                                    (val: string) => {
                                        if (val !== '__custom__') setting.onConfigChange('Device.videoBitRate', val)
                                    }
                                "
                            />
                            <a-input
                                v-if="bitrateValue.value === '__custom__'"
                                :model-value="setting.configGet('Device.videoBitRate', '8M').value"
                                style="width: 10rem; margin-top: 0.25rem"
                                size="small"
                                @input="setting.onConfigChange('Device.videoBitRate', $event)"
                            >
                                <template #append>{{ $t('device.bitrateUnit') }}</template>
                            </a-input>
                        </div>
                    </div>
                    <div class="flex mb-3">
                        <div class="flex-grow">{{ $t('device.maxFps') }}</div>
                        <div class="">
                            <a-select
                                :model-value="fpsValue.value"
                                style="width: 10rem"
                                size="small"
                                allow-search
                                :options="fpsOptions"
                                @change="
                                    (val: string) => {
                                        if (val !== '__custom__') setting.onConfigChange('Device.maxFps', val)
                                    }
                                "
                            />
                            <a-input
                                v-if="fpsValue.value === '__custom__'"
                                :model-value="setting.configGet('Device.maxFps', '60').value"
                                style="width: 10rem; margin-top: 0.25rem"
                                size="small"
                                @input="setting.onConfigChange('Device.maxFps', $event)"
                            >
                                <template #append>{{ $t('device.fpsUnit') }}</template>
                            </a-input>
                        </div>
                    </div>
                    <div class="flex mb-3">
                        <div class="flex-grow">
                            <div>{{ $t('device.customArgs') }}</div>
                            <div class="text-gray-400 text-xs">{{ $t('device.customArgsHint') }}</div>
                        </div>
                        <div class="">
                            <a-input
                                :model-value="setting.configGet('Device.scrcpyArgs', '').value"
                                style="width: 16rem"
                                size="small"
                                @input="setting.onConfigChange('Device.scrcpyArgs', $event)"
                                :placeholder="'--lock-video-orientation=0 --crop 720:1280:0:0'"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </a-modal>
</template>
