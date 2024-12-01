<script setup lang="ts">

import {nextTick, onMounted, ref} from "vue";
import {AppConfig} from "../config";

const loading = ref(true)
const webUrl = ref('')
const webPreload = ref('')
let webInstance = ref(null as any)
const webLoadFail = ref(false)

onMounted(async () => {
    webPreload.value = await window.$mapi.app.getPreload()
    webUrl.value = AppConfig.guideUrl
    await nextTick(() => {
        webInstance.value = document.getElementById('userWeb') as any
        webInstance.value.addEventListener('did-fail-load', (event: any) => {
            webLoadFail.value = true
        });
        webInstance.value.addEventListener('dom-ready', () => {
            loading.value = false
            // webInstance.value.openDevTools()
        });
    })
});

const doRefresh = () => {
    webInstance.value.reload()
}

</script>

<template>
    <div v-if="!!webUrl" class="pb-guide-container relative">
        <webview id="userWeb" :src="webUrl" nodeintegration :preload="webPreload" class="pb-guide"></webview>
        <div v-if="loading"
             class="absolute inset-0 flex bg-white text-white">
            <div class="m-auto text-center text-gray-400">
                <div>
                    <icon-loading class="text-3xl"/>
                </div>
                <div class="text-sm pt-2">
                    加载中...
                </div>
            </div>
        </div>
        <div v-if="webLoadFail"
             class="absolute inset-0 flex bg-black bg-opacity-50 text-white">
            <div class="m-auto text-center text-red-400">
                <div>
                    <icon-info-circle class="text-3xl"/>
                </div>
                <div>
                    内容加载失败，请检查网络连接
                </div>
                <div class="mt-4">
                    <a-button size="mini" @click="doRefresh">
                        <template #icon>
                            <icon-refresh class="tw-mr-1"/>
                        </template>
                        刷新
                    </a-button>
                </div>
            </div>
        </div>
    </div>
</template>

<style lang="less" scoped>
.pb-guide {
    width: 100%;
    height: calc(100vh - 2.5rem);
}
</style>
