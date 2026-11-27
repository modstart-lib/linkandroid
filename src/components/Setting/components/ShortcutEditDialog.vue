<script setup lang="ts">
import {computed, ref} from 'vue'
import {isValidKeys} from '../../../../electron/lib/shortcutKeys'
import {t} from '../../../lang'
import {Dialog} from '../../../lib/dialog'
import ShortcutKeyInput from './ShortcutKeyInput.vue'
import ShortcutPointPicker from './ShortcutPointPicker.vue'

type ShortcutAction = {
    type: 'tap' | 'longPress' | 'multiTap' | 'swipe' | 'panel' | 'text' | 'app'
    x?: number
    y?: number
    x2?: number
    y2?: number
    duration?: number
    times?: number
    interval?: number
    buttonId?: string
    text?: string
    package?: string
}

type ShortcutItem = {
    id: string
    keys: string
    action: ShortcutAction
    enabled?: boolean
    deviceId?: string
}

const props = defineProps<{
    devices: Array<{id: string; name: string; screenshot?: string | null}>
    existingKeys: Array<{id: string; keys: string; deviceId?: string}>
}>()

const emit = defineEmits(['saved'])

const visible = ref(false)
const pickerVisible = ref(false)
const captureLoading = ref(false)

const form = ref<ShortcutItem>({
    id: '',
    keys: '',
    action: {type: 'tap', x: 0.5, y: 0.5},
})

// 适用范围：空字符串 = 全部设备
const scope = ref('')
// 拾取点位用的设备（全局配置时单独选择一台截图）
const pickDeviceId = ref('')
// 拾取时截取的实时画面
const capturedImage = ref('')

const actionTypeOptions = [
    {value: 'tap', label: 'setting.shortcut.actionTap'},
    {value: 'longPress', label: 'setting.shortcut.actionLongPress'},
    {value: 'multiTap', label: 'setting.shortcut.actionMultiTap'},
    {value: 'swipe', label: 'setting.shortcut.actionSwipe'},
    {value: 'panel', label: 'setting.shortcut.actionPanel'},
    {value: 'text', label: 'setting.shortcut.actionText'},
    {value: 'app', label: 'setting.shortcut.actionApp'},
]

const panelButtonOptions = [
    {value: 'home', label: 'panel.home'},
    {value: 'back', label: 'panel.back'},
    {value: 'recent', label: 'panel.recent'},
    {value: 'volume_up', label: 'panel.volumeUp'},
    {value: 'volume_down', label: 'panel.volumeDown'},
    {value: 'screenshot', label: 'panel.screenshot'},
    {value: 'rotate', label: 'panel.rotate'},
    {value: 'screen_power', label: 'panel.screenPower'},
    {value: 'close', label: 'panel.close'},
]

const deviceOptions = computed(() => {
    return props.devices.map((one) => ({label: one.name || one.id, value: one.id}))
})

const scopeOptions = computed(() => {
    return [{label: t('setting.shortcut.scopeAll'), value: ''}, ...deviceOptions.value]
})

// 拾取时可选的手机：单机快捷键只用自己的设备，全局快捷键可在弹窗里临时挑一台
const pickerDevices = computed(() => {
    if (scope.value) {
        const one = props.devices.find((item) => item.id === scope.value)
        return one ? [{id: one.id, name: one.name}] : []
    }
    return props.devices.map((item) => ({id: item.id, name: item.name}))
})

// 优先用实时截图，失败时回退到该设备最近一次预览图
const pickerImage = computed(() => {
    if (capturedImage.value) {
        return capturedImage.value
    }
    const matched = props.devices.find((one) => one.id === pickDeviceId.value)
    return matched?.screenshot || null
})

const isPointAction = computed(() => {
    return ['tap', 'longPress', 'multiTap', 'swipe'].includes(form.value.action.type)
})

const isSwipe = computed(() => form.value.action.type === 'swipe')

const pointText = computed(() => {
    const action = form.value.action
    const percent = (value: number) => `${Math.round(value * 100)}%`
    const start = `${percent(action.x ?? 0.5)}, ${percent(action.y ?? 0.5)}`
    if (!isSwipe.value) {
        return start
    }
    return `${start} → ${percent(action.x2 ?? 0.5)}, ${percent(action.y2 ?? 0.2)}`
})

const errorKey = computed(() => {
    if (!form.value.keys) {
        return 'setting.shortcut.errKeys'
    }
    if (!isValidKeys(form.value.keys)) {
        return 'setting.shortcut.errInvalidKeys'
    }
    const duplicated = props.existingKeys.some((one) => {
        return one.keys === form.value.keys && one.id !== form.value.id && (one.deviceId || '') === scope.value
    })
    if (duplicated) {
        return 'setting.shortcut.errDuplicate'
    }
    if (form.value.action.type === 'panel' && !form.value.action.buttonId) {
        return 'setting.shortcut.errPanel'
    }
    if (form.value.action.type === 'text' && !form.value.action.text) {
        return 'setting.shortcut.errText'
    }
    if (form.value.action.type === 'app' && !form.value.action.package) {
        return 'setting.shortcut.errPackage'
    }
    if (isSwipe.value) {
        const same =
            (form.value.action.x ?? 0.5) === (form.value.action.x2 ?? 0.5) &&
            (form.value.action.y ?? 0.5) === (form.value.action.y2 ?? 0.2)
        if (same) {
            return 'setting.shortcut.errSwipeSame'
        }
    }
    return ''
})

const reset = () => {
    form.value = {
        id: '',
        keys: '',
        action: {type: 'tap', x: 0.5, y: 0.5},
    }
    scope.value = ''
    pickDeviceId.value = props.devices[0]?.id || ''
    capturedImage.value = ''
}

const show = () => {
    visible.value = true
}

const add = () => {
    reset()
    show()
}

const edit = (item: ShortcutItem) => {
    form.value = JSON.parse(JSON.stringify(item))
    scope.value = item.deviceId || ''
    pickDeviceId.value = item.deviceId || props.devices[0]?.id || ''
    capturedImage.value = ''
    const action = form.value.action
    if (action.type === 'panel' && !action.buttonId) {
        action.buttonId = 'back'
    }
    show()
}

const onTypeChange = () => {
    const action = form.value.action
    action.x = action.x ?? 0.5
    action.y = action.y ?? 0.5
    if (action.type === 'longPress' && !action.duration) {
        action.duration = 800
    }
    if (action.type === 'multiTap') {
        action.times = action.times || 2
        action.interval = action.interval || 120
    }
    if (action.type === 'swipe') {
        action.x2 = action.x2 ?? 0.5
        action.y2 = action.y2 ?? 0.2
        action.duration = action.duration || 300
    }
    if (action.type === 'panel' && !action.buttonId) {
        action.buttonId = 'back'
    }
}

const onScopeChange = () => {
    if (scope.value) {
        pickDeviceId.value = scope.value
    }
}

// 拾取前实时截取手机屏幕，保证点位对应现在的画面
const doCapture = async (deviceId: string) => {
    if (!deviceId) {
        return
    }
    captureLoading.value = true
    capturedImage.value = ''
    try {
        const base64 = await window.$mapi.adb.screencap(deviceId)
        capturedImage.value = 'data:image/png;base64,' + base64
    } catch (e: any) {
        Dialog.tipError(t('setting.shortcut.captureFailed'))
    } finally {
        captureLoading.value = false
    }
}

const doPickPoint = async () => {
    const list = pickerDevices.value
    if (!list.length) {
        Dialog.tipError(t('setting.shortcut.noDevice'))
        return
    }
    if (!list.some((one) => one.id === pickDeviceId.value)) {
        pickDeviceId.value = list[0].id
    }
    pickerVisible.value = true
    await doCapture(pickDeviceId.value)
}

const onPickerDevice = async (deviceId: string) => {
    pickDeviceId.value = deviceId
    await doCapture(deviceId)
}

const onPointChange = (point: {x: number; y: number; x2?: number; y2?: number}) => {
    form.value.action.x = point.x
    form.value.action.y = point.y
    if (isSwipe.value) {
        form.value.action.x2 = point.x2 ?? 0.5
        form.value.action.y2 = point.y2 ?? 0.2
    }
}

const doSave = () => {
    if (errorKey.value) {
        return
    }
    const item: ShortcutItem = JSON.parse(JSON.stringify(form.value))
    if (!item.id) {
        item.id = Math.random().toString(16).slice(2, 10)
    }
    if (scope.value) {
        item.deviceId = scope.value
    } else {
        delete item.deviceId
    }
    emit('saved', item)
    visible.value = false
}

defineExpose({add, edit})
</script>

<template>
    <a-modal v-model:visible="visible" width="min(680px, 94vw)" :footer="false" title-align="start">
        <template #title>
            <div class="font-bold">
                {{ form.id ? $t('setting.shortcut.editTitle') : $t('setting.shortcut.addTitle') }}
            </div>
        </template>
        <div class="p-2 space-y-4">
            <div>
                <div class="mb-1 text-sm font-medium">{{ $t('setting.shortcut.keys') }}</div>
                <ShortcutKeyInput v-model="form.keys" />
                <div class="mt-1 text-xs text-gray-500">
                    {{ $t('setting.shortcut.keyHint') }}
                </div>
            </div>

            <div>
                <div class="mb-1 text-sm font-medium">{{ $t('setting.shortcut.scope') }}</div>
                <a-select v-model="scope" class="w-full" :options="scopeOptions" @change="onScopeChange" />
                <div class="mt-1 text-xs text-gray-500">{{ $t('setting.shortcut.scopeHint') }}</div>
            </div>

            <div>
                <div class="mb-1 text-sm font-medium">{{ $t('setting.shortcut.action') }}</div>
                <a-select
                    v-model="form.action.type"
                    class="w-full"
                    :options="actionTypeOptions.map((one) => ({label: $t(one.label), value: one.value}))"
                    @change="onTypeChange"
                />
            </div>

            <div v-if="isPointAction" class="space-y-3">
                <div class="flex flex-wrap items-center gap-3">
                    <div class="text-sm text-gray-600 dark:text-gray-400">
                        {{ isSwipe ? $t('setting.shortcut.swipeRange') : $t('setting.shortcut.point') }}:
                        {{ pointText }}
                    </div>
                    <a-button :loading="captureLoading" @click="doPickPoint">
                        {{ $t('setting.shortcut.pickPoint') }}
                    </a-button>
                </div>
                <div v-if="form.action.type === 'longPress'" class="flex items-center gap-2">
                    <span class="text-sm">{{ $t('setting.shortcut.duration') }}</span>
                    <a-input-number v-model="form.action.duration" class="!w-36" :min="200" :max="10000" :step="100" />
                </div>
                <div v-if="isSwipe" class="flex items-center gap-2">
                    <span class="text-sm">{{ $t('setting.shortcut.swipeDuration') }}</span>
                    <a-input-number v-model="form.action.duration" class="!w-36" :min="80" :max="5000" :step="20" />
                </div>
                <div v-if="form.action.type === 'multiTap'" class="flex items-center gap-4">
                    <div class="flex items-center gap-2">
                        <span class="text-sm">{{ $t('setting.shortcut.times') }}</span>
                        <a-input-number v-model="form.action.times" class="!w-28" :min="1" :max="20" />
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="text-sm">{{ $t('setting.shortcut.interval') }}</span>
                        <a-input-number v-model="form.action.interval" class="!w-36" :min="40" :max="5000" :step="10" />
                    </div>
                </div>
            </div>

            <div v-if="form.action.type === 'panel'">
                <div class="mb-1 text-sm font-medium">{{ $t('setting.shortcut.panelButton') }}</div>
                <a-select
                    v-model="form.action.buttonId"
                    class="w-full"
                    :options="panelButtonOptions.map((one) => ({label: $t(one.label), value: one.value}))"
                />
            </div>

            <div v-if="form.action.type === 'text'">
                <div class="mb-1 text-sm font-medium">{{ $t('setting.shortcut.text') }}</div>
                <a-input v-model="form.action.text" :placeholder="$t('setting.shortcut.textPlaceholder')" />
            </div>

            <div v-if="form.action.type === 'app'">
                <div class="mb-1 text-sm font-medium">{{ $t('setting.shortcut.package') }}</div>
                <a-input v-model="form.action.package" :placeholder="$t('setting.shortcut.packagePlaceholder')" />
                <div class="mt-1 text-xs text-gray-500">{{ $t('setting.shortcut.packageHint') }}</div>
            </div>

            <div v-if="errorKey" class="text-sm text-red-500">{{ $t(errorKey) }}</div>

            <div class="flex justify-end gap-2 pt-2">
                <a-button @click="visible = false">{{ $t('common.cancel') }}</a-button>
                <a-button type="primary" :disabled="!!errorKey" @click="doSave">{{ $t('common.save') }}</a-button>
            </div>
        </div>

        <ShortcutPointPicker
            v-model:visible="pickerVisible"
            :image="pickerImage"
            :devices="pickerDevices"
            :device-id="pickDeviceId"
            :loading="captureLoading"
            :mode="isSwipe ? 'swipe' : 'point'"
            :x="form.action.x ?? 0.5"
            :y="form.action.y ?? 0.5"
            :x2="form.action.x2 ?? 0.5"
            :y2="form.action.y2 ?? 0.2"
            @select-device="onPickerDevice"
            @change="onPointChange"
        />
    </a-modal>
</template>
