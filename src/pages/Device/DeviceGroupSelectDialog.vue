<script setup lang="ts">
import {computed, onMounted, onUnmounted, ref} from 'vue'
import {Dialog} from '../../lib/dialog'
import {t} from '../../lang'
import {testActionSet, testActionUnset} from '../../utils/test'
import {useDeviceStore} from '../../store/modules/device'

const visible = ref(false)
const deviceId = ref('')
const selectedGroupIds = ref<string[]>([])

const deviceStore = useDeviceStore()

const groupOptions = computed(() => {
    return deviceStore.groups.map((g) => ({
        label: g.name,
        value: g.id,
    }))
})

const show = (id: string) => {
    deviceId.value = id
    selectedGroupIds.value = deviceStore.groups.filter((g) => g.deviceIds.includes(id)).map((g) => g.id)
    visible.value = true
}
onMounted(() => {
    testActionSet('device.groupSelect.show', (data: any) => {
        const id = data?.deviceId || deviceStore.records[0]?.id
        if (id) show(id)
    })
})

onUnmounted(() => {
    testActionUnset('device.groupSelect.show')
})

defineExpose({show})

const doSave = async () => {
    try {
        await deviceStore.setDeviceGroups(deviceId.value, selectedGroupIds.value)
        visible.value = false
        Dialog.tipSuccess(t('device.groupSelectSaved'))
    } catch (e) {
        Dialog.tipError(t('device.groupSelectSaveFailed'))
    }
}
</script>

<template>
    <a-modal v-model:visible="visible" width="min(400px, 90vw)" title-align="start" @cancel="visible = false">
        <template #title>
            <div class="font-bold">{{ $t('device.groupSelectTitle') }}</div>
        </template>
        <div style="min-height: 200px">
            <div v-if="groupOptions.length === 0" class="text-gray-400 text-center py-8">
                {{ $t('device.noGroups') }}
            </div>
            <a-checkbox-group v-model="selectedGroupIds" direction="vertical" v-else>
                <a-checkbox v-for="opt in groupOptions" :key="opt.value" :value="opt.value">
                    {{ opt.label }}
                </a-checkbox>
            </a-checkbox-group>
        </div>
        <template #footer>
            <div class="flex justify-end gap-2 pt-3">
                <a-button @click="visible = false">{{ $t('common.cancel') }}</a-button>
                <a-button type="primary" @click="doSave">{{ $t('common.save') }}</a-button>
            </div>
        </template>
    </a-modal>
</template>
