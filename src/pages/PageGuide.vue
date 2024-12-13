<script setup lang="ts">

import {nextTick, onBeforeMount, onMounted, ref} from "vue";
import {AppConfig} from "../config";
import PageWebviewStatus from "../components/common/PageWebviewStatus.vue";

const status = ref<InstanceType<typeof PageWebviewStatus> | null>(null)
const web = ref<any | null>(null)
const webPreload = ref('')
const webUrl = ref('')
const webUserAgent = window.$mapi.app.getUserAgent()

onMounted(async () => {
    webPreload.value = await window.$mapi.app.getPreload()
    nextTick(() => {
        web.value.addEventListener('did-fail-load', (event: any) => {
            status.value?.setStatus('fail')
        });
        web.value.addEventListener('dom-ready', () => {
            // web.value.openDevTools()
            status.value?.setStatus('success')
        });
        status.value?.setStatus('loading')
        webUrl.value = AppConfig.guideUrl
    })
});

</script>

<template>
    <div class="pb-guide-container relative">
        <div v-if="webPreload">
            <webview ref="web"
                     id="web"
                     :src="webUrl"
                     :useragent="webUserAgent"
                     nodeintegration
                     :preload="webPreload"></webview>
        </div>
        <PageWebviewStatus ref="status"/>
    </div>
</template>

<style lang="less" scoped>
.pb-guide-container, #web {
    width: 100%;
    height: calc(100vh - 2.5rem);
}
</style>
