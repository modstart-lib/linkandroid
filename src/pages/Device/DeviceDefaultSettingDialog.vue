<script setup lang="ts">
import {computed, onMounted, onUnmounted, ref} from 'vue'
import {testActionSet, testActionUnset} from '../../utils/test'
import SettingItemYesNo from '../../components/common/SettingItemYesNo.vue'
import {t} from '../../lang'
import {useSettingStore} from '../../store/modules/setting'

const setting = useSettingStore()
const visible = ref(false)
const formData = ref({
    autoMirror: '',
    dimWhenMirror: '',
    alwaysTop: '',
    mirrorSound: '',
    previewImage: '',
    panelShow: '',
    powerSaveBlock: '',
    windowBorderless: '',
})

const bitratePresets = ['2M', '4M', '6M', '8M', '10M', '12M', '16M', '20M', '40M', '50M']
const fpsPresets = ['30', '60', '90', '120', '144', '240']

const bitrateValue = computed(() => setting.configGet('Device.videoBitRate', '8M').value)
const fpsValue = computed(() => setting.configGet('Device.maxFps', '60').value)

const bitrateOptions = computed(() => {
    const options = bitratePresets.map((v) => ({label: v, value: v}))
    const current = bitrateValue.value
    if (current && !bitratePresets.includes(current)) {
        options.unshift({label: `${current} (${t('common.custom')})`, value: current})
    }
    return options
})

const fpsOptions = computed(() => {
    const options = fpsPresets.map((v) => ({label: v, value: v}))
    const current = fpsValue.value
    if (current && !fpsPresets.includes(current)) {
        options.unshift({label: `${current} (${t('common.custom')})`, value: current})
    }
    return options
})
const show = async () => {
    formData.value.autoMirror = setting.configGet('Device.autoMirror', 'no').value
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
    await setting.setConfig('Device.autoMirror', formData.value.autoMirror)
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
    <a-modal v-model:visible="visible" width="min(640px, 95vw)" title-align="start">
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
            <div class="p-5">
                <div>
                    <div class="font-bold text-xl mb-3">
                        {{ $t('device.title') }}
                    </div>
                    <div class="flex mb-3">
                        <div class="flex-grow">{{ $t('device.autoMirror') }}</div>
                        <div class="">
                            <SettingItemYesNo v-model="formData.autoMirror" />
                        </div>
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
                                :model-value="bitrateValue"
                                style="width: 10rem"
                                size="small"
                                allow-search
                                allow-create
                                :options="bitrateOptions"
                                @change="(val: string) => setting.onConfigChange('Device.videoBitRate', val)"
                            />
                        </div>
                    </div>
                    <div class="flex mb-3">
                        <div class="flex-grow">
                            <div>{{ $t('device.maxFps') }}</div>
                            <div class="text-gray-400 text-xs">{{ $t('device.maxFpsHint') }}</div>
                        </div>
                        <div class="">
                            <a-select
                                :model-value="fpsValue"
                                style="width: 10rem"
                                size="small"
                                allow-search
                                allow-create
                                :options="fpsOptions"
                                @change="(val: string) => setting.onConfigChange('Device.maxFps', val)"
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
