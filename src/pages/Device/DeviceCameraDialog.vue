<script setup lang="ts">
import {computed, onMounted, onUnmounted, ref, toRaw} from 'vue'
import {t} from '../../lang'
import {testActionSet, testActionUnset} from '../../utils/test'
import {Dialog} from '../../lib/dialog'
import {mapError} from '../../lib/error'
import {sleep} from '../../lib/util'
import {DeviceRecord, EnumDeviceStatus} from '../../types/Device'
import {useDeviceStore} from '../../store/modules/device'
import {buildCameraArgs, cameraOrientationOptions, CameraInfo} from '../../../electron/mapi/scrcpy/cameraParse'

const visible = ref(false)
const device = ref<DeviceRecord | null>(null)

const CAMERA_CONFIG_KEY = 'Device.camera'

// Fallback values used before the device reports its cameras, or when the list
// cannot be read (old ROM / permission denied). Keeping the old behaviour.
const FALLBACK_SIZES = ['3840x2160', '1920x1080', '1280x720', '640x480', '320x240']
const FALLBACK_FPS = [60, 30, 15, 10]
const BIT_RATE_OPTIONS = ['4M', '8M', '12M', '16M']

const DEMO_CAMERAS: CameraInfo[] = [
    {
        id: '0',
        facing: 'back',
        activeSize: '4000x3000',
        fps: [60, 30, 15],
        zoomRange: {min: 1, max: 10},
        sizes: ['4000x3000', '1920x1080', '1280x720'],
        highSpeed: [],
    },
    {
        id: '1',
        facing: 'front',
        activeSize: '3264x2448',
        fps: [30],
        zoomRange: {min: 1, max: 4},
        sizes: ['3264x2448', '1920x1080'],
        highSpeed: [],
    },
    {
        id: '2',
        facing: 'external',
        activeSize: '1920x1080',
        fps: [30],
        zoomRange: null,
        sizes: ['1920x1080', '1280x720'],
        highSpeed: [],
    },
]

const form = ref({
    cameraId: '0',
    cameraSize: '',
    cameraFps: '',
    orientation: '0',
    zoom: 1,
    torch: false,
    bitRate: '8M',
    alwaysOnTop: true,
    fullscreen: false,
    borderless: false,
})

const cameras = ref<CameraInfo[]>([])
const camerasLoading = ref(false)
const camerasError = ref('')
const cameraCache = new Map<string, CameraInfo[]>()

const deviceStore = useDeviceStore()

const selectedCamera = computed(() => cameras.value.find((c) => c.id === form.value.cameraId) || null)

const facingLabel = (facing: string) => {
    switch (facing) {
        case 'back':
            return t('device.cameraFacingBack')
        case 'front':
            return t('device.cameraFacingFront')
        case 'external':
            return t('device.cameraFacingExternal')
    }
    return t('device.cameraFacingUnknown')
}

const cameraLabel = (camera: CameraInfo, list: CameraInfo[]) => {
    const sameFacing = list.filter((c) => c.facing === camera.facing).length
    const base = `${facingLabel(camera.facing)}${camera.activeSize ? ` (${camera.activeSize})` : ''}`
    return sameFacing > 1 ? `${base} #${camera.id}` : base
}

const cameraOptions = computed(() => {
    if (cameras.value.length) {
        return cameras.value.map((c) => ({
            label: cameraLabel(c, cameras.value),
            value: c.id,
        }))
    }
    return [
        {label: t('device.cameraRear'), value: '0'},
        {label: t('device.cameraFront'), value: '1'},
    ]
})

const sizeOptions = computed(() => {
    const list = selectedCamera.value?.sizes?.length ? selectedCamera.value.sizes : FALLBACK_SIZES
    return [{label: t('device.cameraResolutionAuto'), value: ''}, ...list.map((size) => ({label: size, value: size}))]
})

const fpsOptions = computed(() => {
    const list = selectedCamera.value?.fps?.length ? selectedCamera.value.fps : FALLBACK_FPS
    return [
        {label: t('device.cameraFpsAuto'), value: ''},
        ...list.map((fps) => ({label: String(fps), value: String(fps)})),
    ]
})

const orientationOptions = computed(() =>
    cameraOrientationOptions().map((item) => ({
        label: t(item.labelKey),
        value: item.value,
    })),
)

const bitRateOptions = computed(() => BIT_RATE_OPTIONS.map((value) => ({label: value, value})))

const zoomRange = computed(() => selectedCamera.value?.zoomRange || null)
const showZoom = computed(() => !!zoomRange.value && zoomRange.value.max > 1)
const showTorch = computed(() => {
    const facing = selectedCamera.value?.facing
    return !facing || facing === 'back' || facing === 'front'
})

const normalizeSelection = () => {
    const list = cameras.value
    if (!list.length) {
        return
    }
    if (!list.some((c) => c.id === form.value.cameraId)) {
        form.value.cameraId = list[0].id
        form.value.cameraSize = ''
        form.value.cameraFps = ''
        form.value.zoom = 1
        form.value.torch = false
    }
    const camera = list.find((c) => c.id === form.value.cameraId)
    if (!camera) {
        return
    }
    if (form.value.cameraSize && !camera.sizes.includes(form.value.cameraSize)) {
        form.value.cameraSize = ''
    }
    if (form.value.cameraFps && camera.fps.length && !camera.fps.map(String).includes(form.value.cameraFps)) {
        form.value.cameraFps = ''
    }
    const max = camera.zoomRange?.max || 0
    if (!max || form.value.zoom > max) {
        form.value.zoom = 1
    }
    if (camera.facing === 'external') {
        form.value.torch = false
    }
}

const onCameraChange = () => {
    form.value.cameraSize = ''
    form.value.cameraFps = ''
    form.value.zoom = 1
    form.value.torch = false
}

const loadCameras = async (record: DeviceRecord | null, force: boolean = false) => {
    if (!record) return
    if (!force && cameraCache.has(record.id)) {
        cameras.value = cameraCache.get(record.id) as CameraInfo[]
        normalizeSelection()
        return
    }
    camerasLoading.value = true
    camerasError.value = ''
    try {
        const list = await $mapi.scrcpy.listCameras(record.id, {timeoutMs: 12000})
        if (device.value?.id !== record.id) {
            return
        }
        cameraCache.set(record.id, list)
        cameras.value = list
        normalizeSelection()
        if (!list.length) {
            camerasError.value = t('device.cameraListEmpty')
        }
    } catch {
        if (device.value?.id !== record.id) {
            return
        }
        cameras.value = []
        camerasError.value = t('device.cameraListFailed')
    } finally {
        if (device.value?.id === record.id) {
            camerasLoading.value = false
        }
    }
}

const loadSavedConfig = async () => {
    let saved: Record<string, any> = {}
    try {
        saved = (await $mapi.config.get(CAMERA_CONFIG_KEY, {})) || {}
    } catch {}
    form.value.cameraId = String(saved.cameraId ?? '0')
    form.value.cameraSize = String(saved.cameraSize ?? '')
    form.value.cameraFps = String(saved.cameraFps ?? '')
    form.value.orientation = String(saved.orientation ?? '0')
    form.value.zoom = Number(saved.zoom ?? 1) || 1
    form.value.torch = !!saved.torch
    form.value.bitRate = String(saved.bitRate ?? '8M')
    form.value.alwaysOnTop = saved.alwaysOnTop !== false
    form.value.fullscreen = !!saved.fullscreen
    form.value.borderless = !!saved.borderless
}

const show = async (record: DeviceRecord) => {
    if (record.status !== EnumDeviceStatus.CONNECTED) {
        Dialog.tipError(t('device.notConnected'))
        return
    }
    device.value = record
    cameras.value = cameraCache.get(record.id) || []
    camerasError.value = ''
    camerasLoading.value = false
    await loadSavedConfig()
    visible.value = true
    // 自动化测试与截图不启动真实 scrcpy，由 test action 注入摄像头列表
    if (!window.__TEST_MODE__) {
        loadCameras(record, false)
    }
}

const escapeHtml = (value: string) => {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const stopCameraProcess = () => {
    if (!device.value) return
    const runtime = deviceStore.runtimeOf(device.value)
    if (runtime.cameraController) {
        try {
            runtime.cameraController.stop()
        } catch {}
        runtime.cameraController = null
    }
}

const doStartCamera = async () => {
    if (!device.value) return
    if (device.value.status !== EnumDeviceStatus.CONNECTED) {
        Dialog.tipError(t('device.notConnected'))
        return
    }
    const info = await $mapi.adb.info(device.value.id)
    if (info.version < 12) {
        Dialog.tipError(t('device.versionLow'))
        return
    }
    const deviceId = device.value.id
    const runtime = deviceStore.runtimeOf(device.value)
    const hadController = !!runtime.cameraController
    stopCameraProcess()
    if (hadController) {
        // 等旧进程释放手机端摄像头，避免紧接着启动时相机被占用
        await sleep(600)
    }
    visible.value = false
    Dialog.loadingOn(t('device.openingCamera'))

    const args = buildCameraArgs({
        ...form.value,
        zoom: String(form.value.zoom),
    })
    let stderrText = ''
    let failed = false
    let controller: any = null
    try {
        controller = await $mapi.scrcpy.mirror(deviceId, {
            title: device.value.name as string,
            args,
            stderr: (data: string) => {
                stderrText = (stderrText + data).slice(-4000)
            },
            success: () => {
                // 运行态读到的是响应式代理，取原始对象才能与 controller 按引用比较
                if (toRaw(runtime.cameraController) === controller) {
                    runtime.cameraController = null
                }
            },
            error: (msg: string) => {
                failed = true
                if (toRaw(runtime.cameraController) === controller) {
                    runtime.cameraController = null
                }
                const detail = stderrText.trim() || String(msg)
                Dialog.alertError(t('device.cameraStartFailed') + `\n\n<pre>${escapeHtml(detail.slice(-1200))}</pre>`)
            },
        })
        runtime.cameraController = controller
        await $mapi.config.set(CAMERA_CONFIG_KEY, {...form.value})
        await sleep(2000)
        if (!failed) {
            Dialog.tipSuccess(t('device.openCameraSuccess'))
        }
    } catch (error) {
        Dialog.tipError(mapError(error))
    } finally {
        Dialog.loadingOff()
    }
}

onMounted(() => {
    testActionSet('device.camera.show', () => {
        const record = deviceStore.records[0]
        if (record) show(record)
    })
    testActionSet('device.camera.fill', (payload: Record<string, any>) => {
        if (payload) {
            Object.assign(form.value, payload)
        }
    })
    testActionSet('device.camera.refresh', () => {
        return loadCameras(device.value, true)
    })
    testActionSet('device.camera.setList', (payload: CameraInfo[] | {list: CameraInfo[]; error?: string}) => {
        const list = Array.isArray(payload) ? payload : payload?.list || []
        cameras.value = list
        camerasError.value = Array.isArray(payload) ? '' : payload?.error || ''
        camerasLoading.value = false
        normalizeSelection()
    })
    testActionSet('device-camera.prepare', () => {
        const record = deviceStore.records[0]
        if (!record) return
        device.value = record
        cameras.value = DEMO_CAMERAS
        camerasError.value = ''
        camerasLoading.value = false
        form.value.cameraId = DEMO_CAMERAS[0].id
        form.value.cameraSize = '1920x1080'
        form.value.cameraFps = '30'
        form.value.zoom = 2
        form.value.torch = true
        form.value.orientation = '0'
        form.value.alwaysOnTop = true
        visible.value = true
    })
    testActionSet('device-camera.cleanup', () => {
        visible.value = false
    })
})

onUnmounted(() => {
    testActionUnset('device.camera.show')
    testActionUnset('device.camera.fill')
    testActionUnset('device.camera.refresh')
    testActionUnset('device.camera.setList')
    testActionUnset('device-camera.prepare')
    testActionUnset('device-camera.cleanup')
})

defineExpose({
    show,
})
</script>

<template>
    <a-modal v-model:visible="visible" width="min(720px, 95vw)" :footer="false" title-align="start">
        <template #title>
            <div class="font-bold">{{ $t('device.cameraSettings') }}</div>
        </template>
        <div class="pt-0 pb-4">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <div class="text-sm text-gray-500 dark:text-gray-400 mb-2">{{ $t('device.cameraSelect') }}</div>
                    <div class="flex items-stretch">
                        <a-select
                            v-model="form.cameraId"
                            class="camera-field camera-camera-select flex-1 min-w-0"
                            :options="cameraOptions"
                            :loading="camerasLoading"
                            @change="onCameraChange"
                        />
                        <a-tooltip :content="$t('device.cameraRefresh')">
                            <a-button
                                class="camera-refresh shrink-0 !h-8 !w-9 !rounded-l-none"
                                :loading="camerasLoading"
                                :aria-label="$t('device.cameraRefresh')"
                                @click="loadCameras(device, true)"
                            >
                                <template #icon>
                                    <i-lucide-refresh-cw />
                                </template>
                            </a-button>
                        </a-tooltip>
                    </div>
                </div>
                <div>
                    <div class="text-sm text-gray-500 dark:text-gray-400 mb-2">
                        {{ $t('device.cameraOrientation') }}
                    </div>
                    <a-select v-model="form.orientation" class="camera-field w-full" :options="orientationOptions" />
                </div>
                <div>
                    <div class="text-sm text-gray-500 dark:text-gray-400 mb-2">{{ $t('device.cameraResolution') }}</div>
                    <a-select
                        v-model="form.cameraSize"
                        class="camera-field w-full"
                        :options="sizeOptions"
                        allow-search
                    />
                </div>
                <div>
                    <div class="text-sm text-gray-500 dark:text-gray-400 mb-2">{{ $t('device.cameraFps') }}</div>
                    <a-select v-model="form.cameraFps" class="camera-field w-full" :options="fpsOptions" />
                </div>
                <div v-if="showZoom">
                    <div class="flex items-center justify-between mb-2">
                        <span class="text-sm text-gray-500 dark:text-gray-400">{{ $t('device.cameraZoom') }}</span>
                        <span class="text-xs text-gray-500 dark:text-gray-400">
                            {{ zoomRange?.min }}×–{{ zoomRange?.max }}×
                        </span>
                    </div>
                    <a-input-number
                        v-model="form.zoom"
                        class="camera-field w-full"
                        :min="zoomRange?.min || 1"
                        :max="zoomRange?.max || 1"
                        :step="0.5"
                        :precision="1"
                    />
                </div>
                <div>
                    <div class="text-sm text-gray-500 dark:text-gray-400 mb-2">{{ $t('device.cameraBitRate') }}</div>
                    <a-select v-model="form.bitRate" class="camera-field w-full" :options="bitRateOptions" />
                </div>
            </div>
            <div
                v-if="camerasError"
                role="alert"
                class="mt-3 flex items-start gap-1.5 rounded-lg bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-800 dark:text-amber-300"
            >
                <i-mdi-alert-circle-outline class="w-4 h-4 flex-shrink-0" />
                <span>{{ camerasError }}</span>
            </div>
            <div v-if="showTorch" class="mt-4 flex items-center justify-between">
                <span class="text-sm text-gray-500 dark:text-gray-400">{{ $t('device.cameraTorch') }}</span>
                <a-tooltip :content="$t('device.cameraTorchHint')">
                    <a-switch v-model="form.torch" />
                </a-tooltip>
            </div>
            <div class="mt-4 border-t border-gray-100 dark:border-white/10 pt-4">
                <div class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {{ $t('device.cameraWindow') }}
                </div>
                <div class="flex flex-wrap items-center gap-6">
                    <div class="flex items-center gap-2 text-sm">
                        <a-switch v-model="form.alwaysOnTop" />
                        <span>{{ $t('device.cameraAlwaysOnTop') }}</span>
                    </div>
                    <div class="flex items-center gap-2 text-sm">
                        <a-switch v-model="form.fullscreen" />
                        <span>{{ $t('device.cameraFullscreen') }}</span>
                    </div>
                    <div class="flex items-center gap-2 text-sm">
                        <a-switch v-model="form.borderless" />
                        <span>{{ $t('device.cameraBorderless') }}</span>
                    </div>
                </div>
            </div>
            <div class="mt-4 border-t border-gray-100 dark:border-white/10 pt-3">
                <div class="text-xs text-gray-500 dark:text-gray-400 mb-1">
                    {{ $t('device.cameraShortcutHold') }}
                </div>
                <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                    <span class="whitespace-nowrap">←/→ {{ $t('device.cameraShortcutRotate') }}</span>
                    <span class="whitespace-nowrap">Shift + ↑↓←→ {{ $t('device.cameraShortcutFlip') }}</span>
                    <span class="whitespace-nowrap">↑/↓ {{ $t('device.cameraShortcutZoom') }}</span>
                    <span class="whitespace-nowrap">T {{ $t('device.cameraShortcutTorch') }}</span>
                    <span class="whitespace-nowrap">F {{ $t('device.cameraShortcutFullscreen') }}</span>
                </div>
            </div>
            <div class="flex justify-end gap-2 mt-6">
                <a-button @click="visible = false">
                    {{ $t('common.cancel') }}
                </a-button>
                <a-button type="primary" @click="doStartCamera">
                    <template #icon>
                        <i-mdi-camera />
                    </template>
                    {{ $t('device.cameraStart') }}
                </a-button>
            </div>
        </div>
    </a-modal>
</template>

<style scoped>
.camera-camera-select :deep(.arco-select-view) {
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
}

.camera-refresh {
    border-left: 0;
}

.camera-field :deep(.arco-select-view),
.camera-field.arco-input-number {
    border: 1px solid transparent;
}

body[data-theme='dark'] .camera-field :deep(.arco-select-view),
body[data-theme='dark'] .camera-field.arco-input-number {
    border-color: rgba(255, 255, 255, 0.12);
}
</style>
