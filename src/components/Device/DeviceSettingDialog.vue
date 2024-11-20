<script setup lang="ts">
import {computed, ref} from "vue";
import {DeviceRecord} from "../../types/Device";
import {useDeviceStore} from "../../store/modules/device";
import {t} from "../../lang";
import SettingItemYesNoDefault from "../common/SettingItemYesNoDefault.vue";

const deviceStore = useDeviceStore()
const visible = ref(false)
const formData = ref({
    dimWhenMirror: '',
    alwaysTop: '',
    mirrorSound: '',
})
const device = ref<DeviceRecord | null>(null)
const infoColumns = [
    {
        title: t('名称'),
        dataIndex: 'name',
        width: 200,
    },
    {
        title: t('值'),
        dataIndex: 'value',
    },
];

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
    visible.value = true
}

const doSubmit = async () => {
    await deviceStore.updateSetting(device.value!.id, {
        dimWhenMirror: formData.value.dimWhenMirror,
        alwaysTop: formData.value.alwaysTop,
        mirrorSound: formData.value.mirrorSound,
    })
    visible.value = false
}

defineExpose({
    show
})
</script>

<template>
    <a-modal v-model:visible="visible"
             width="40rem"
             title-align="start">
        <template #title>
            <icon-mobile/>
            {{ $t('设备') }} {{ device?.name }}
        </template>
        <template #footer>
            <a-button type="primary" @click="doSubmit">
                {{ $t('保存') }}
            </a-button>
        </template>
        <div v-if="visible" class="-mx-5 -my-6">
            <div class="overflow-y-auto p-5" style="height:calc(80vh - 200px);">
                <div>
                    <div class="font-bold text-xl mb-3">
                        {{ $t('投屏') }}
                    </div>
<!--                    <div class="flex mb-3">-->
<!--                        <div class="flex-grow">{{ $t('投屏时调暗屏幕') }}</div>-->
<!--                        <div class="">-->
<!--                            <SettingItemYesNoDefault v-model="formData.dimWhenMirror"/>-->
<!--                        </div>-->
<!--                    </div>-->
                    <div class="flex mb-3">
                        <div class="flex-grow">{{ $t('投屏总在最上层') }}</div>
                        <div class="">
                            <SettingItemYesNoDefault v-model="formData.alwaysTop"/>
                        </div>
                    </div>
                    <div class="flex mb-3">
                        <div class="flex-grow">{{ $t('投屏时转发声音') }}</div>
                        <div class="">
                            <SettingItemYesNoDefault v-model="formData.mirrorSound"/>
                        </div>
                    </div>
                    <div class="font-bold text-xl mb-3">
                        {{ $t('其他') }}
                    </div>
                    <div class="w-full">
                        <a-table :columns="infoColumns"
                                 size="small"
                                 width="100%"
                                 :data="deviceDataInfo"
                                 :pagination="false"/>
                    </div>
                </div>
            </div>
        </div>
    </a-modal>
</template>

