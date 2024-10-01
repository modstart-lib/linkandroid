<script setup lang="ts">

import {onMounted, ref} from "vue";

const visible = ref(false)
const remember = ref(false)
// exit | hide
const exitMode = ref('')

const show = async () => {
    exitMode.value = await window.$mapi.config.get('exitMode', '')
    if (exitMode.value) {
        if (exitMode.value === 'exit') {
            await doExit()
        } else if (exitMode.value === 'hide') {
            await doHide()
        }
        return
    }
    visible.value = true
}

const doCancel = () => {
    visible.value = false
}

const doHide = async () => {
    if (remember.value) {
        exitMode.value = 'hide'
        await window.$mapi.config.set('exitMode', exitMode.value)
    }
    visible.value = false
    await window.$mapi.app.windowHide()
}

const doExit = async () => {
    if (remember.value) {
        exitMode.value = 'exit'
        await window.$mapi.config.set('exitMode', exitMode.value)
    }
    visible.value = false
    await window.$mapi.app.quit()
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
            <a-button @click="doCancel">{{ $t('取消') }}</a-button>
            <a-button @click="doHide">{{ $t('隐藏窗口') }}</a-button>
            <a-button type="primary" @click="doExit">{{ $t('退出') }}</a-button>
        </template>
        <div>
            <div class="text-center">{{ $t('确定退出软件？') }}</div>
            <div class="text-center">
                <a-checkbox v-model="remember">{{ $t('记住我的选择') }}</a-checkbox>
            </div>
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
