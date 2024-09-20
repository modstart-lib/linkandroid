<script setup lang="ts">
import {ref} from "vue";
import {Dialog} from "../lib/dialog";
import {t} from "../lang";

const visible = ref(false)
const createData = ref({
    ip: '',
    port: 5555
})
const show = () => {
    visible.value = true
}
const doSubmit = async () => {
    Dialog.tipSuccess(t('创建成功'))
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
            <a-button @click="doSubmit">
                {{ $t('测试连接') }}
            </a-button>
            <a-button type="primary"
                      @click="doSubmit">
                {{ $t('连接设备') }}
            </a-button>
        </template>
        <div>
            <div class="px-2">
                <a-form :model="createData" layout="vertical">
                    <a-form-item :label="$t('IP地址')">
                        <a-input v-model="createData.ip"
                                 placeholder="192.168.x.x"/>
                    </a-form-item>
                    <a-form-item :label="$t('端口')">
                        <a-input-number v-model="createData.port"
                                        placeholder="5555"/>
                    </a-form-item>
                </a-form>
            </div>
        </div>
    </a-modal>
</template>

