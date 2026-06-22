<script setup lang="ts">
import {ref} from 'vue'

const visible = ref(false)

const show = () => {
    visible.value = true
}

const doLogin = () => {
    visible.value = false
    window.$mapi.user.open()
}

defineExpose({show})
</script>

<template>
    <a-modal v-model:visible="visible" width="min(460px, 90vw)" :footer="false" title-align="start">
        <template #title>
            <div class="font-bold">{{ $t('common.tip') }}</div>
        </template>
        <div
            class="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[rgb(var(--primary-1))] via-white to-[rgb(var(--primary-2))] p-6"
        >
            <div class="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-[rgb(var(--primary-3))]/40"></div>
            <div class="absolute -bottom-16 -left-16 h-40 w-40 rounded-full bg-[rgb(var(--primary-2))]/60"></div>
            <div class="relative text-center">
                <div
                    class="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-[var(--color-primary)] text-white shadow-lg shadow-[rgb(var(--primary-3))]"
                >
                    <icon-user class="text-4xl" aria-hidden="true" />
                </div>
                <div class="mb-2 text-xl font-bold text-gray-900">{{ $t('hint.loginRequired') }}</div>
                <div class="mx-auto mb-6 max-w-xs text-sm leading-6 text-gray-500">
                    {{ $t('login.desc') }}
                </div>
                <div class="flex items-center justify-center gap-3">
                    <a-button class="min-w-24" @click="visible = false">{{ $t('common.later') }}</a-button>
                    <a-button type="primary" class="min-w-28 shadow-lg shadow-[rgb(var(--primary-3))]" @click="doLogin">
                        <template #icon><icon-user aria-hidden="true" /></template>
                        {{ $t('common.login') }}
                    </a-button>
                </div>
            </div>
        </div>
    </a-modal>
</template>
