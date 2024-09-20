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
            {{ $t('命令行工具') }}
        </template>
        <template #footer>
            <div></div>
        </template>
        <div>
            <div class="px-2 h-48 bg-gray-100">

            </div>
        </div>
    </a-modal>
</template>

