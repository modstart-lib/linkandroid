<script setup lang="ts">
import {computed, onMounted, onUnmounted, ref} from 'vue'
import {testActionSet, testActionUnset} from '../../utils/test'
import {t} from '../../lang'
import {Dialog} from '../../lib/dialog'
import {mapError} from '../../lib/error'
import {useDeviceStore} from '../../store/modules/device'
import {AppMirror, DeviceRecord, EnumDeviceStatus} from '../../types/Device'

type AppRecord = {
    id: string
    name: string
    system?: boolean
}

const deviceStore = useDeviceStore()
const visible = ref(false)
const device = ref<DeviceRecord | null>(null)
const loading = ref(false)
const apps = ref<AppRecord[]>([])
const searchKeywords = ref('')
const showSystemApps = ref(false)
const appPackage = ref('')
const displaySize = ref('')
const customSize = ref('')
const displayDpi = ref('')
const androidVersion = ref(0)
const loadError = ref('')

const sizeOptions = computed(() => [
    {label: t('device.mirrorAppSizeFollow'), value: ''},
    {label: '540x960', value: '540x960'},
    {label: '720x1280', value: '720x1280'},
    {label: '1080x1920', value: '1080x1920'},
    {label: t('common.custom'), value: 'custom'},
])

const dpiOptions = computed(() => [
    {label: t('common.default'), value: ''},
    {label: '160', value: '160'},
    {label: '240', value: '240'},
    {label: '320', value: '320'},
    {label: '420', value: '420'},
    {label: '480', value: '480'},
    {label: '600', value: '600'},
])

const appMirrors = computed<AppMirror[]>(() => {
    const record = device.value
    if (!record) return []
    return deviceStore.runtimeOf(record).appMirrors || []
})

const filterApps = computed(() => {
    const keywords = searchKeywords.value.toLowerCase()
    return apps.value.filter((app) => {
        if (!showSystemApps.value && app.system) return false
        if (!keywords) return true
        return app.name.toLowerCase().includes(keywords) || app.id.toLowerCase().includes(keywords)
    })
})

const doLoadApps = async () => {
    if (!device.value) return
    loading.value = true
    loadError.value = ''
    try {
        apps.value = await $mapi.scrcpy.listApps(device.value.id)
    } catch (error) {
        loadError.value = mapError(error)
    } finally {
        loading.value = false
    }
}

const show = (record: DeviceRecord) => {
    if (record.status !== EnumDeviceStatus.CONNECTED) {
        Dialog.tipError(t('device.notConnected'))
        return
    }
    device.value = record
    appPackage.value = record.setting?.appPackage || ''
    displaySize.value = record.setting?.appDisplaySize || ''
    displayDpi.value = record.setting?.appDisplayDpi || ''
    customSize.value = ''
    searchKeywords.value = ''
    showSystemApps.value = false
    apps.value = []
    loadError.value = ''
    androidVersion.value = 0
    visible.value = true
    doLoadApps().then()
    $mapi.adb
        .info(record.id)
        .then((info: any) => {
            androidVersion.value = Number(info?.version || 0)
        })
        .catch(() => {})
}

const doSubmit = async () => {
    if (!device.value) return
    if (!appPackage.value) {
        Dialog.tipError(t('device.mirrorAppSelectRequired'))
        return
    }
    if (appMirrors.value.some((m) => m.package === appPackage.value)) {
        Dialog.tipError(t('device.mirrorAppExists'))
        return
    }
    let size = displaySize.value
    if ('custom' === size) {
        size = customSize.value.trim()
        if (!/^\d{2,5}x\d{2,5}$/.test(size)) {
            Dialog.tipError(t('device.mirrorAppSizeInvalid'))
            return
        }
    }
    try {
        visible.value = false
        await deviceStore.doMirrorApp(device.value, {
            appPackage: appPackage.value,
            appName: apps.value.find((a) => a.id === appPackage.value)?.name || appPackage.value,
            appDisplaySize: size,
            appDisplayDpi: displayDpi.value,
        })
    } catch (error) {
        Dialog.tipError(mapError(error))
    }
}

const isAppMirroring = (appPackage_: string) => {
    return appMirrors.value.some((m) => m.package === appPackage_)
}

const doStopMirror = (appPackage_: string) => {
    if (!device.value) return
    deviceStore.stopAppMirror(device.value, appPackage_)
}

const fillForm = (data: Partial<{appPackage: string; displaySize: string; customSize: string; displayDpi: string}>) => {
    if ('appPackage' in data) appPackage.value = data.appPackage as string
    if ('displaySize' in data) displaySize.value = data.displaySize as string
    if ('customSize' in data) customSize.value = data.customSize as string
    if ('displayDpi' in data) displayDpi.value = data.displayDpi as string
}

defineExpose({
    show,
})

onMounted(() => {
    testActionSet('device.mirrorApp.show', (deviceId: string) => {
        const record = deviceId ? deviceStore.records.find((r) => r.id === deviceId) : deviceStore.records[0]
        if (record) show(record)
    })
    testActionSet('device.mirrorApp.setApps', (list: AppRecord[]) => {
        apps.value = list || []
    })
    testActionSet('device.mirrorApp.setMirrors', (list: any[]) => {
        if (!device.value) return
        deviceStore.runtimeOf(device.value).appMirrors = (list || []).map((m) => ({
            package: m.package,
            name: m.name || m.package,
            controller: null,
        }))
    })
    testActionSet('device.mirrorApp.getMirrors', () => {
        return appMirrors.value.map((m) => m.package)
    })
    testActionSet('device.mirrorApp.stop', (appPackage_: string) => doStopMirror(appPackage_))
    testActionSet('device.mirrorApp.fill', (data: any) => fillForm(data || {}))
    testActionSet('device.mirrorApp.getForm', () => ({
        appPackage: appPackage.value,
        displaySize: displaySize.value,
        displayDpi: displayDpi.value,
    }))
})

onUnmounted(() => {
    testActionUnset('device.mirrorApp.show')
    testActionUnset('device.mirrorApp.setApps')
    testActionUnset('device.mirrorApp.setMirrors')
    testActionUnset('device.mirrorApp.getMirrors')
    testActionUnset('device.mirrorApp.stop')
    testActionUnset('device.mirrorApp.fill')
    testActionUnset('device.mirrorApp.getForm')
})
</script>

<template>
    <a-modal v-model:visible="visible" width="min(880px, 95vw)" :footer="false" title-align="start">
        <template #title>
            <div class="font-bold">{{ $t('device.mirrorApp') }}</div>
        </template>
        <div style="height: calc(100vh - 15rem)" class="flex flex-col gap-3">
            <div class="text-xs text-gray-500">
                {{ $t('device.mirrorAppDesc') }}
            </div>
            <div v-if="appMirrors.length" class="border border-gray-200 rounded p-2">
                <div class="text-xs text-gray-500 mb-1">{{ $t('device.mirrorAppRunning') }}</div>
                <div v-for="m in appMirrors" :key="m.package" class="flex items-center gap-2 py-1">
                    <i-lucide-cast class="w-4 h-4 text-blue-500" aria-hidden="true" />
                    <div class="text-sm">{{ m.name }}</div>
                    <div class="text-xs text-gray-400">{{ m.package }}</div>
                    <a-button class="ml-auto" @click="doStopMirror(m.package)">
                        {{ $t('device.mirrorAppStop') }}
                    </a-button>
                </div>
            </div>
            <a-alert v-if="androidVersion && androidVersion < 13" type="warning">
                {{ $t('device.mirrorAppVersionHint', {version: androidVersion}) }}
            </a-alert>
            <div class="grid grid-cols-2 gap-3">
                <div>
                    <div class="text-xs text-gray-500 mb-1">{{ $t('device.mirrorAppSize') }}</div>
                    <a-select v-model="displaySize" :options="sizeOptions" />
                </div>
                <div>
                    <div class="text-xs text-gray-500 mb-1">{{ $t('device.mirrorAppDpi') }}</div>
                    <a-select v-model="displayDpi" :options="dpiOptions" />
                </div>
            </div>
            <a-input
                v-if="'custom' === displaySize"
                v-model="customSize"
                :placeholder="$t('device.mirrorAppSizePlaceholder')"
            />
            <div class="flex items-center gap-3">
                <a-input
                    v-model="searchKeywords"
                    allow-clear
                    :placeholder="$t('device.mirrorAppSearch')"
                    class="flex-1"
                >
                    <template #prefix>
                        <i-lucide-search />
                    </template>
                </a-input>
                <a-switch v-model="showSystemApps" />
                <div class="text-xs text-gray-500 flex-shrink-0">{{ $t('device.mirrorAppShowSystem') }}</div>
            </div>
            <div class="flex-1 min-h-0 overflow-auto border border-gray-200 rounded p-1">
                <div v-if="loading" class="p-4 text-center text-sm text-gray-400">
                    <a-spin :size="16" /> {{ $t('device.mirrorAppLoading') }}
                </div>
                <div v-else-if="loadError && !apps.length" class="p-4 text-center text-sm text-red-400">
                    {{ loadError }}
                    <a-button class="ml-2" @click="doLoadApps()">{{ $t('common.refresh') }}</a-button>
                </div>
                <div v-else-if="filterApps.length === 0" class="p-4 text-center text-sm text-gray-400">
                    {{ $t('device.mirrorAppEmpty') }}
                </div>
                <div
                    v-for="app in filterApps"
                    :key="app.id"
                    class="flex items-center gap-2 px-3 py-2 rounded cursor-pointer hover:bg-gray-100"
                    :class="app.id === appPackage ? 'bg-blue-50' : ''"
                    @click="appPackage = app.id"
                >
                    <div class="text-sm">{{ app.name }}</div>
                    <div class="text-xs text-gray-400">{{ app.id }}</div>
                    <a-tag v-if="app.system">{{ $t('device.mirrorAppSystemTag') }}</a-tag>
                    <a-tag v-if="isAppMirroring(app.id)" color="blue">{{ $t('device.mirrorAppRunningTag') }}</a-tag>
                    <i-lucide-check v-if="app.id === appPackage" class="ml-auto text-blue-500 w-4 h-4" />
                </div>
            </div>
            <div class="flex justify-end gap-2">
                <a-button @click="visible = false">{{ $t('common.cancel') }}</a-button>
                <a-button type="primary" :loading="loading" @click="doSubmit()">
                    {{ $t('device.mirrorAppStart') }}
                </a-button>
            </div>
        </div>
    </a-modal>
</template>
