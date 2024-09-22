<script setup lang="ts">
import {computed, ref} from "vue";
import {DeviceRecord} from "../../types/Device";
import {useDeviceStore} from "../../store/modules/device";

const deviceStore = useDeviceStore()
const visible = ref(false)
const deviceData = computed(() => {
    return deviceStore.records.find(d => d.id === deviceId.value) as DeviceRecord | null
})
const deviceDataInfo = computed(() => {
    return Object.entries(deviceData.value?.raw || {}).map(([name, value]) => {
        return {name, value}
    })
})
const deviceId = ref('')
const show = (device: DeviceRecord) => {
    deviceId.value = device.id as string
    visible.value = true
}

const infoColumns = [
    {
        title: 'Name',
        dataIndex: 'name',
    },
    {
        title: 'Value',
        dataIndex: 'value',
    },
];

defineExpose({
    show
})
</script>

<template>
    <a-modal v-model:visible="visible"
             width="50rem"
             :footer="false"
             title-align="start">
        <template #title>
            <icon-mobile/>
            {{ $t('设备') }} {{ deviceData?.name }}
        </template>
        <div style="height:60vh;">
            <div>
                <div v-if="deviceData?.raw"
                     class="">
                    <a-table :columns="infoColumns"
                             width="100%"
                             :data="deviceDataInfo"
                             :pagination="false"/>
                </div>
            </div>
        </div>
    </a-modal>
</template>

