<script setup lang="ts">

import {ref} from "vue";

const visible = ref(false)
const show = () => {
    visible.value = true
}

const doMin = () => {
    visible.value = false
    window.$mapi.app.windowHide()
}

const doCancel = () => {
    visible.value = false
}

const doConfirm = () => {
    visible.value = false
    window.$mapi.app.quit()
}

defineExpose({
    show
})

</script>

<template>
    <a-modal v-model:visible="visible"
             width="22rem"
             modal-class="pb-app-quit-confirm"
             :closable="true"
             :title="$t('提示')"
             title-align="start">
        <template #footer>
            <a-button @click="doMin">最小化</a-button>
            <a-button @click="doCancel">取消</a-button>
            <a-button type="primary" @click="doConfirm">确定</a-button>
        </template>
        <div>
            <div class="text-center">确定退出软件？</div>
        </div>
    </a-modal>
</template>

<style lang="less">
.pb-app-quit-confirm {
    .arco-modal-header {
        border-bottom: none;
    }

    .arco-modal-footer {
        border-top: none;
    }
}
</style>
