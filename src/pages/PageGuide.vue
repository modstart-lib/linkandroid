<script setup lang="ts">

import {onMounted, ref} from "vue";
import {AppConfig} from "../config";
import PageWebviewStatus from "../components/common/PageWebviewStatus.vue";

const status = ref<InstanceType<typeof PageWebviewStatus> | null>(null)
const web = ref<any | null>(null)
const webPreload = ref('')
const webUrl = ref('')

onMounted(async () => {
    web.value.addEventListener('did-fail-load', (event: any) => {
        status.value?.setStatus('fail')
    });
    web.value.addEventListener('dom-ready', () => {
        status.value?.setStatus('success')
    });
    status.value?.setStatus('loading')
    webPreload.value = await window.$mapi.app.getPreload()
    webUrl.value = AppConfig.guideUrl
});

</script>

<template>
    <div class="pb-guide-container relative">
        <webview ref="web" :src="webUrl" nodeintegration :preload="webPreload" class="pb-guide-web"></webview>
        <PageWebviewStatus ref="status"/>
    </div>
</template>

<style lang="less" scoped>
.pb-guide-container, .pb-guide-web {
    width: 100%;
    height: calc(100vh - 2.5rem);
}
</style>
