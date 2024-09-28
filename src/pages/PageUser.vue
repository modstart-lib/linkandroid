<script setup lang="ts">

import {nextTick, onMounted, ref} from "vue";
import {useUserStore} from "../store/modules/user";

const user = useUserStore()

const webUrl = ref('')
let webInstance = ref(null as any)

const canGoBack = ref(false)

onMounted(async () => {
    webUrl.value = await user.webUrl()
    await nextTick(() => {
        webInstance.value = document.getElementById('userWeb') as any
        webInstance.value.addEventListener('dom-ready', () => {
            // webInstance.value.openDevTools()
            window.$mapi.event.callPage('main', 'doRefreshUserInfo')
            canGoBack.value = webInstance.value.canGoBack()
            // add css
            webInstance.value.insertCSS(`
                .pb-page-member-vip .top{ padding-left: 5rem; }
            `)
        });
    })
});

const doBack = () => {
    if (webInstance.value.canGoBack()) {
        webInstance.value.goBack()
    }
}

</script>

<template>
    <div v-if="!!webUrl" class="pb-user-container relative">
        <webview id="userWeb" :src="webUrl" class="pb-user"></webview>
        <div class="absolute left-5 top-8 z-40">
            <a-button v-if="canGoBack"
                      @click="doBack"
                      type="secondary" shape="round">
                <template #icon>
                    <icon-left/>
                </template>
                {{ $t('返回') }}
            </a-button>
        </div>
    </div>
</template>

<style lang="less" scoped>
.pb-user {
    width: 100%;
    height: calc(100vh - 2.5rem);
}
</style>
