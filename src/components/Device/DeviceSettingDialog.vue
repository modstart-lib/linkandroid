<script setup lang="ts">
import {computed, ref} from "vue";
import {DeviceRecord} from "../../types/Device";
import {useDeviceStore} from "../../store/modules/device";
import {t} from "../../lang";

const deviceStore = useDeviceStore()
const visible = ref(false)
const formData = ref({
    dimWhenMirror: false,
    alwaysTop: false,
    mirrorSound: false,
})
const device = ref<DeviceRecord | null>(null)
const infoColumns = [
    {
        title: t('名称'),
        dataIndex: 'name',
        width: 100,
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
    formData.value.dimWhenMirror = record.setting?.dimWhenMirror || false
    formData.value.alwaysTop = record.setting?.alwaysTop || false
    formData.value.mirrorSound = record.setting?.mirrorSound || false
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
             width="50rem"
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
                <a-form :model="{}" layout="vertical">
                    <a-form-item :label="$t('投屏')">
                        <a-checkbox v-if="0" v-model="formData.dimWhenMirror" size="small" class="mr-2">
                            {{ $t('投屏时调暗屏幕') }}
                        </a-checkbox>
                        <a-checkbox v-model="formData.alwaysTop" size="small" class="mr-2">
                            {{ $t('投屏总在最上层') }}
                        </a-checkbox>
                        <a-checkbox v-model="formData.mirrorSound" size="small" class="mr-2">
                            {{ $t('投屏时转发声音') }}
                        </a-checkbox>
                    </a-form-item>
                    <a-form-item v-if="device?.raw" :label="$t('其他')">
                        <div class="w-full">
                            <a-table :columns="infoColumns"
                                     size="mini"
                                     width="100%"
                                     :data="deviceDataInfo"
                                     :pagination="false"/>
                        </div>
                    </a-form-item>
                </a-form>
            </div>
            <div>

            </div>
        </div>
    </a-modal>
</template>

