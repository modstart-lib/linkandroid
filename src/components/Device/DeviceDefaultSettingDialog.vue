<script setup lang="ts">
import {ref} from "vue";
import SettingItemYesNo from "../common/SettingItemYesNo.vue";

const visible = ref(false)
const formData = ref({
    dimWhenMirror: '',
    alwaysTop: '',
    mirrorSound: '',
})
const show = async () => {
    formData.value.dimWhenMirror = await window.$mapi.config.get('Device.dimWhenMirror', 'no')
    formData.value.alwaysTop = await window.$mapi.config.get('Device.alwaysTop', 'no')
    formData.value.mirrorSound = await window.$mapi.config.get('Device.mirrorSound', 'no')
    visible.value = true
}

const doSubmit = async () => {
    await window.$mapi.config.set('Device.dimWhenMirror', formData.value.dimWhenMirror)
    await window.$mapi.config.set('Device.alwaysTop', formData.value.alwaysTop)
    await window.$mapi.config.set('Device.mirrorSound', formData.value.mirrorSound)
    visible.value = false
}

defineExpose({
    show
})
</script>

<template>
    <a-modal v-model:visible="visible"
             width="40rem"
             title-align="start">
        <template #title>
            <icon-mobile/>
            {{ $t('默认设置') }}
        </template>
        <template #footer>
            <a-button type="primary" @click="doSubmit">
                {{ $t('保存') }}
            </a-button>
        </template>
        <div v-if="visible" class="-mx-5 -my-6">
            <div class="overflow-y-auto p-5" style="height:calc(80vh - 200px);">
                <div>
                    <div class="font-bold text-xl mb-3">
                        {{ $t('投屏') }}
                    </div>
<!--                    <div class="flex mb-3">-->
<!--                        <div class="flex-grow">{{ $t('投屏时调暗屏幕') }}</div>-->
<!--                        <div class="">-->
<!--                            <SettingItemYesNo v-model="formData.dimWhenMirror"/>-->
<!--                        </div>-->
<!--                    </div>-->
                    <div class="flex mb-3">
                        <div class="flex-grow">{{ $t('投屏总在最上层') }}</div>
                        <div class="">
                            <SettingItemYesNo v-model="formData.alwaysTop"/>
                        </div>
                    </div>
                    <div class="flex mb-3">
                        <div class="flex-grow">{{ $t('投屏时转发声音') }}</div>
                        <div class="">
                            <SettingItemYesNo v-model="formData.mirrorSound"/>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </a-modal>
</template>

