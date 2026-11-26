<script setup lang="ts">
import {ref} from 'vue'
import {t} from '../../lang'

const emit = defineEmits<{
    saved: [dependencies: string[]]
}>()

const visible = ref(false)
const loading = ref(false)
const saving = ref(false)
const taskId = ref(0)
const text = ref('')
const missing = ref<string[]>([])

const doLoad = async () => {
    loading.value = true
    try {
        const manifest = await window.$mapi.project.manifest(taskId.value)
        const dependencies: string[] = manifest?.dependencies || []
        text.value = dependencies.join('\n')
        missing.value = await window.$mapi.pyenv.check(dependencies)
    } catch {
        text.value = ''
        missing.value = []
    } finally {
        loading.value = false
    }
}

const show = (task: {id: number}) => {
    taskId.value = Number(task?.id || 0)
    text.value = ''
    missing.value = []
    visible.value = true
    if (taskId.value) {
        doLoad()
    }
}

const doSave = async () => {
    if (!taskId.value) return
    const dependencies = text.value
        .split('\n')
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
    saving.value = true
    try {
        const saved = await window.$mapi.project.setDependencies(taskId.value, dependencies)
        missing.value = await window.$mapi.pyenv.check(saved)
        window.$mapi.app.toast(t('task.depsSaved'))
        emit('saved', saved)
    } catch (e: any) {
        window.$mapi.app.toast(String(e?.message || e))
    } finally {
        saving.value = false
    }
}

const doInstallMissing = async () => {
    if (!missing.value.length) return
    saving.value = true
    try {
        const result = await window.$mapi.pyenv.install([...missing.value])
        if (!result.ok) {
            window.$mapi.app.toast(t('task.depsInstallFailed'))
            return
        }
        missing.value = await window.$mapi.pyenv.check([...missing.value])
        window.$mapi.app.toast(t('task.depsInstallDone'))
    } finally {
        saving.value = false
    }
}

defineExpose({show})
</script>

<template>
    <a-modal v-model:visible="visible" width="min(600px, 90vw)" :footer="false" title-align="start">
        <template #title>
            <div class="font-bold">{{ t('task.depsTitle') }}</div>
        </template>
        <div class="space-y-3">
            <p class="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{{ t('task.depsDesc') }}</p>
            <a-textarea
                v-model="text"
                :auto-size="{minRows: 6, maxRows: 12}"
                :placeholder="t('task.depsPlaceholder')"
                :disabled="loading || saving"
            />
            <div v-if="missing.length" class="flex items-center justify-between gap-2">
                <div class="text-sm text-orange-500">{{ t('task.depsMissingNow') }}{{ missing.join('、') }}</div>
                <a-button type="primary" :loading="saving" @click="doInstallMissing">
                    <template #icon><i-lucide-package-plus /></template>
                    {{ t('task.depsInstallButton') }}
                </a-button>
            </div>
            <div class="flex justify-end gap-2">
                <a-button @click="visible = false">{{ t('common.cancel') }}</a-button>
                <a-button type="primary" :loading="saving" :disabled="loading" @click="doSave">
                    <template #icon><i-lucide-check /></template>
                    {{ t('task.depsSave') }}
                </a-button>
            </div>
        </div>
    </a-modal>
</template>
