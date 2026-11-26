<script setup lang="ts">
import {computed, onBeforeUnmount, onMounted, ref} from 'vue'
import {t} from '../../lang'
import {testActionSet, testActionUnset} from '../../utils/test'

type PyenvPackage = {name: string; version: string; builtin: boolean}

const loading = ref(false)
const installing = ref(false)
const clearing = ref(false)
const version = ref('')
const overlayPath = ref('')
const size = ref(0)
const packages = ref<PyenvPackage[]>([])
const input = ref('')
const indexUrl = ref('')
const showAdvanced = ref(false)
const logLines = ref<string[]>([])
const failed = ref('')
const filter = ref<'user' | 'all'>('user')

const userCount = computed(() => packages.value.filter((item) => !item.builtin).length)
const visiblePackages = computed(() =>
    filter.value === 'all' ? packages.value : packages.value.filter((item) => !item.builtin),
)
const sizeText = computed(() => {
    const bytes = size.value
    if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
    if (bytes > 1024) return `${(bytes / 1024).toFixed(0)} KB`
    return bytes > 0 ? `${bytes} B` : '-'
})

const doLoad = async () => {
    loading.value = true
    try {
        const info = await window.$mapi.pyenv.info()
        version.value = info.pythonVersion
        overlayPath.value = info.overlayPath
        size.value = info.size
        packages.value = info.packages
    } catch (e: any) {
        failed.value = String(e?.message || e)
    } finally {
        loading.value = false
    }
}

const doInstall = async () => {
    const list = input.value
        .split(/[\s,]+/)
        .map((item) => item.trim())
        .filter(Boolean)
    if (!list.length) {
        window.$mapi.app.toast(t('setting.python.needPackage'))
        return
    }
    installing.value = true
    failed.value = ''
    logLines.value = []
    try {
        const result = await window.$mapi.pyenv.install(list, {
            indexUrl: indexUrl.value.trim() || undefined,
        })
        if (!result.ok) {
            failed.value = (result.error || '').slice(-500)
            window.$mapi.app.toast(t('setting.python.installFailed'))
        } else {
            input.value = ''
            window.$mapi.app.toast(t('setting.python.installDone'))
        }
    } catch (e: any) {
        failed.value = String(e?.message || e)
    } finally {
        installing.value = false
        await doLoad()
    }
}

const doUninstall = async (name: string) => {
    await window.$mapi.pyenv.uninstall(name)
    await doLoad()
}

const doClear = async () => {
    clearing.value = true
    try {
        await window.$mapi.pyenv.clear()
        await doLoad()
        window.$mapi.app.toast(t('setting.python.clearDone'))
    } finally {
        clearing.value = false
    }
}

const doOpenDir = async () => {
    await window.$mapi.pyenv.openDir()
}

let offInstallLog: (() => void) | null = null

onMounted(() => {
    doLoad()
    offInstallLog = window.$mapi.pyenv.onInstallLog((data) => {
        if (data.line) {
            logLines.value.push(data.line)
            if (logLines.value.length > 500) logLines.value.splice(0, logLines.value.length - 500)
        }
    })
    testActionSet('setting.python.ready', async () => {
        await doLoad()
    })
})

onBeforeUnmount(() => {
    offInstallLog?.()
    testActionUnset('setting.python.ready')
})
</script>

<template>
    <div class="max-w-3xl">
        <div class="mb-6">
            <div class="text-base font-medium mb-2">{{ t('setting.python.title') }}</div>
            <p class="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                {{ t('setting.python.desc') }}
            </p>
        </div>

        <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-6 space-y-2">
            <div class="flex items-center gap-2 text-sm">
                <span class="text-gray-500 dark:text-gray-400 w-24 shrink-0">{{ t('setting.python.version') }}</span>
                <span class="font-mono">Python {{ version || '-' }}</span>
            </div>
            <div class="flex items-start gap-2 text-sm">
                <span class="text-gray-500 dark:text-gray-400 w-24 shrink-0">{{ t('setting.python.location') }}</span>
                <span class="font-mono break-all">{{ overlayPath || '-' }}</span>
            </div>
            <div class="flex items-center gap-2 text-sm">
                <span class="text-gray-500 dark:text-gray-400 w-24 shrink-0">{{ t('setting.python.size') }}</span>
                <span v-if="userCount > 0"
                    >{{ sizeText }} · {{ userCount }} {{ t('setting.python.installedCount') }}</span
                >
                <span v-else class="text-gray-400">{{ sizeText }}</span>
            </div>
            <div class="flex items-center gap-2 pt-2">
                <a-button @click="doOpenDir">
                    <template #icon><i-lucide-folder-open /></template>
                    {{ t('setting.python.openDir') }}
                </a-button>
                <a-popconfirm :content="t('setting.python.clearConfirm')" @ok="doClear">
                    <a-button status="danger" :loading="clearing" :disabled="userCount === 0">
                        <template #icon><i-lucide-eraser /></template>
                        {{ t('setting.python.clear') }}
                    </a-button>
                </a-popconfirm>
            </div>
        </div>

        <div class="mb-6">
            <div class="text-base font-medium mb-2">{{ t('setting.python.install') }}</div>
            <div class="flex items-start gap-2">
                <a-input
                    v-model="input"
                    :placeholder="t('setting.python.installPlaceholder')"
                    :disabled="installing"
                    @press-enter="doInstall"
                />
                <a-button type="primary" :loading="installing" @click="doInstall">
                    <template #icon><i-lucide-package-plus /></template>
                    {{ t('setting.python.installButton') }}
                </a-button>
            </div>
            <div class="mt-2">
                <div class="text-sm text-blue-500 cursor-pointer" @click="showAdvanced = !showAdvanced">
                    {{ showAdvanced ? t('common.collapse') : t('setting.python.advanced') }}
                </div>
                <div v-if="showAdvanced" class="mt-2">
                    <a-input
                        v-model="indexUrl"
                        :placeholder="t('setting.python.indexPlaceholder')"
                        :disabled="installing"
                    />
                </div>
            </div>
        </div>

        <div v-if="logLines.length || failed" class="mb-6">
            <div class="text-base font-medium mb-2">{{ t('setting.python.log') }}</div>
            <pre
                class="bg-gray-900 text-gray-100 rounded-lg p-3 text-xs font-mono overflow-auto"
                style="max-height: 240px"
                >{{ logLines.join('') }}</pre
            >
            <div v-if="failed" class="text-sm text-red-500 mt-2 break-all">{{ failed }}</div>
        </div>

        <div>
            <div class="flex items-center justify-between mb-2">
                <div class="text-base font-medium">{{ t('setting.python.packages') }}</div>
                <a-radio-group v-model="filter" type="button">
                    <a-radio value="user">{{ t('setting.python.user') }}</a-radio>
                    <a-radio value="all">{{ t('setting.python.all') }}</a-radio>
                </a-radio-group>
            </div>
            <a-empty v-if="!loading && !visiblePackages.length" :description="t('setting.python.empty')" />
            <a-table
                v-else
                :data="visiblePackages"
                :loading="loading"
                :pagination="false"
                size="small"
                :bordered="false"
            >
                <template #columns>
                    <a-table-column :title="t('setting.python.name')" data-index="name">
                        <template #cell="{record}">
                            <span class="font-mono">{{ record.name }}</span>
                        </template>
                    </a-table-column>
                    <a-table-column :title="t('setting.python.packageVersion')" data-index="version">
                        <template #cell="{record}">
                            <span class="font-mono text-gray-500">{{ record.version }}</span>
                        </template>
                    </a-table-column>
                    <a-table-column :title="t('setting.python.source')">
                        <template #cell="{record}">
                            <a-tag v-if="record.builtin" size="small">{{ t('setting.python.builtin') }}</a-tag>
                            <span v-else class="text-sm">{{ t('setting.python.user') }}</span>
                        </template>
                    </a-table-column>
                    <a-table-column :title="t('setting.python.action')" :width="110">
                        <template #cell="{record}">
                            <a-button
                                v-if="!record.builtin"
                                type="text"
                                status="danger"
                                :disabled="installing"
                                @click="doUninstall(record.name)"
                            >
                                {{ t('setting.python.uninstall') }}
                            </a-button>
                        </template>
                    </a-table-column>
                </template>
            </a-table>
        </div>
    </div>
</template>
