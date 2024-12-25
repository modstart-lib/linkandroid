<script setup lang="ts">
import {nextTick, onBeforeUnmount, onMounted, ref} from 'vue'
import {AppConfig} from "../config";
import {t} from "../lang";
import UpdaterButton from "../components/common/UpdaterButton.vue";
import {useSettingStore} from "../store/modules/setting";
import FeedbackTicketButton from "../components/common/FeedbackTicketButton.vue";
import PageWebviewStatus from "../components/common/PageWebviewStatus.vue";

const setting = useSettingStore()

const status = ref<InstanceType<typeof PageWebviewStatus> | null>(null)
const web = ref<any | null>(null)
const webPreload = ref('')
const webUrl = ref('')
const webUserAgent = window.$mapi.app.getUserAgent()

onMounted(async () => {
    status.value?.setStatus('loading')
    webPreload.value = await window.$mapi.app.getPreload()
    webUrl.value = AppConfig.feedbackUrl
    nextTick(() => {
        web.value.addEventListener('did-fail-load', (event: any) => {
            status.value?.setStatus('fail')
        });
        web.value.addEventListener('dom-ready', async (e) => {
            const appEnv = await window.$mapi.app.appEnv()
            web.value.executeJavaScript(`window.$mapi.app.setRenderAppEnv(${JSON.stringify(appEnv)})`)
            web.value.openDevTools()
            window.$mapi.user.refresh()
            web.value.executeJavaScript(`
document.addEventListener('click', (event) => {
    const target = event.target;
    if (target.tagName !== 'A') return;
    const url = target.href
    if(url.startsWith('javascript:')) return;
    const urlPath = new URL(url).pathname;
    event.preventDefault();
    window.$mapi.user.openWebUrl(url)
});
`)
            status.value?.setStatus('success')
        });
    })
})


</script>

<template>
    <div style="height:calc(100vh - 2.5rem);" class="relative" v-if="webUrl">
        <webview ref="web"
                 id="web"
                 :src="webUrl"
                 :useragent="webUserAgent"
                 nodeintegration
                 :preload="webPreload"></webview>
        <PageWebviewStatus ref="status"/>
    </div>
</template>

<style lang="less" scoped>
#web {
    width: 100%;
    height: calc(100vh - 2.5rem);
}
</style>
