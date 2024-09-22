<script setup lang="ts">
import {ref} from "vue";
import {Dialog} from "../lib/dialog";
import {t} from "../lang";

const visible = ref(false)
const formData = ref({
    host: '',
    port: ''
})
const show = () => {
    visible.value = true
}
const emit = defineEmits({
    update: () => true
})
const doSubmit = async () => {
    Dialog.loadingOn(t('测试连接中'))
    try {
        await window.$mapi.adb.connect(formData.value.host, parseInt(formData.value.port || '5555'))
        Dialog.tipSuccess(t('连接成功'))
        visible.value = false
        emit('update')
    } catch (e) {
        Dialog.tipError(t('连接失败'))
    } finally {
        Dialog.loadingOff()
    }
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
            {{ $t('连接Wifi设备') }}
        </template>
        <template #footer>
            <a-button type="primary"
                      @click="doSubmit">
                {{ $t('连接设备') }}
            </a-button>
        </template>
        <div>
            <div class="px-2">
                <a-form :model="formData" layout="vertical">
                    <a-form-item :label="$t('IP地址')">
                        <a-input v-model="formData.host"
                                 placeholder="192.168.x.x"/>
                    </a-form-item>
                    <a-form-item :label="$t('端口')">
                        <a-input v-model="formData.port"
                                 :placeholder="$t('默认端口 {port}',{port:5555})"/>
                    </a-form-item>
                </a-form>
            </div>
        </div>
    </a-modal>
</template>

