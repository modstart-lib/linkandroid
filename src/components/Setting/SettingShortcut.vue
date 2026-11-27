<script setup lang="ts">
import {computed, onBeforeUnmount, onMounted, ref} from 'vue'
import {SHORTCUT_CONFIG_KEY} from '../../../electron/lib/shortcutKeys'
import {t} from '../../lang'
import {useDeviceStore} from '../../store/modules/device'
import {testActionSet, testActionUnset} from '../../utils/test'
import ShortcutEditDialog from './components/ShortcutEditDialog.vue'

const deviceStore = useDeviceStore()

const items = ref<any[]>([])
const dialog = ref<InstanceType<typeof ShortcutEditDialog> | null>(null)

const devices = computed(() => {
    return deviceStore.records.map((record) => ({
        id: record.id,
        name: record.name || record.id,
        screenshot: record.screenshot,
    }))
})

const deviceName = (deviceId?: string) => {
    if (!deviceId) {
        return ''
    }
    const matched = devices.value.find((one) => one.id === deviceId)
    return matched ? matched.name : deviceId
}

const existingKeys = computed(() => {
    return items.value.map((item) => ({id: item.id, keys: item.keys, deviceId: item.deviceId}))
})

const panelButtonLabels: Record<string, string> = {
    home: 'panel.home',
    back: 'panel.back',
    recent: 'panel.recent',
    volume_up: 'panel.volumeUp',
    volume_down: 'panel.volumeDown',
    screenshot: 'panel.screenshot',
    rotate: 'panel.rotate',
    screen_power: 'panel.screenPower',
    close: 'panel.close',
}

const load = async () => {
    const saved = await window.$mapi.config.get(SHORTCUT_CONFIG_KEY, [])
    items.value = Array.isArray(saved) ? saved : []
}

const save = async () => {
    await window.$mapi.config.set(SHORTCUT_CONFIG_KEY, items.value)
    await window.$mapi.serve.shortcutsSync()
}

const doAdd = () => {
    dialog.value?.add()
}

const doEdit = (item: any) => {
    dialog.value?.edit(item)
}

const doDelete = async (item: any) => {
    items.value = items.value.filter((one) => one.id !== item.id)
    await save()
}

const onToggle = async () => {
    await save()
}

const onSaved = async (item: any) => {
    const index = items.value.findIndex((one) => one.id === item.id)
    if (index >= 0) {
        items.value[index] = item
    } else {
        items.value.push(item)
    }
    await save()
}

const actionText = (item: any) => {
    const action = item.action || {}
    const percent = (value: number) => `${Math.round(value * 100)}%`
    const point = `${percent(action.x ?? 0.5)}, ${percent(action.y ?? 0.5)}`
    switch (action.type) {
        case 'tap':
            return `${t('setting.shortcut.tapAction')} ${point}`
        case 'longPress':
            return `${t('setting.shortcut.longPressAction')} ${action.duration || 800}ms ${point}`
        case 'multiTap':
            return `${t('setting.shortcut.multiTapAction')} ${action.times || 2} ${t('setting.shortcut.timesUnit')} ${point}`
        case 'swipe':
            return `${t('setting.shortcut.swipeAction')} ${point} → ${percent(action.x2 ?? 0.5)}, ${percent(action.y2 ?? 0.2)}`
        case 'panel':
            return `${t('setting.shortcut.actionPanel')} ${t(panelButtonLabels[action.buttonId] || 'setting.shortcut.panelButton')}`
        case 'text':
            return `${t('setting.shortcut.actionText')}「${action.text || ''}」`
        case 'app':
            return `${t('setting.shortcut.actionApp')} ${action.package || ''}`
    }
    return '-'
}

onMounted(() => {
    load().then()
    testActionSet('setting.shortcut.ready', async () => {
        await load()
    })
    testActionSet('setting.shortcut.add', async () => {
        doAdd()
    })
})

onBeforeUnmount(() => {
    testActionUnset('setting.shortcut.ready')
    testActionUnset('setting.shortcut.add')
})
</script>

<template>
    <div class="max-w-3xl">
        <div class="mb-4 flex items-start justify-between gap-4">
            <div class="text-sm text-gray-500">
                {{ $t('setting.shortcut.desc') }}
            </div>
            <a-button type="primary" @click="doAdd">
                <template #icon><icon-plus /></template>
                {{ $t('setting.shortcut.add') }}
            </a-button>
        </div>

        <a-empty v-if="!items.length" :description="$t('setting.shortcut.empty')" />

        <div v-else class="space-y-2">
            <div
                v-for="item in items"
                :key="item.id"
                class="flex items-center gap-3 rounded-lg border border-solid border-gray-200 p-3 dark:border-gray-700"
            >
                <a-tag class="!mr-0 font-mono">{{ item.keys }}</a-tag>
                <a-tag v-if="item.deviceId" color="arcoblue" class="!mr-0">
                    {{ deviceName(item.deviceId) }}
                </a-tag>
                <a-tag v-else class="!mr-0">{{ $t('setting.shortcut.scopeAll') }}</a-tag>
                <div class="flex-1 text-sm text-[var(--color-text)]">{{ actionText(item) }}</div>
                <a-switch
                    :model-value="item.enabled !== false"
                    @change="
                        (value: boolean) => {
                            item.enabled = value
                            onToggle()
                        }
                    "
                />
                <a-button type="text" @click="doEdit(item)">{{ $t('common.edit') }}</a-button>
                <a-button type="text" status="danger" @click="doDelete(item)">{{ $t('common.delete') }}</a-button>
            </div>
        </div>

        <div class="mt-6 rounded-lg bg-gray-50 p-3 text-xs leading-6 text-gray-500 dark:bg-gray-800">
            {{ $t('setting.shortcut.tip') }}
        </div>

        <ShortcutEditDialog ref="dialog" :devices="devices" :existing-keys="existingKeys" @saved="onSaved" />
    </div>
</template>
