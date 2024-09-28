<script setup lang="ts">

import {nextTick, onMounted, ref} from "vue";
import {useUserStore} from "../store/modules/user";

const user = useUserStore()

const webUrl = ref('')
let webInstance = ref(null as any)

onMounted(async () => {
    webUrl.value = await user.webUrl()
    await nextTick(() => {
        webInstance.value = document.getElementById('userWeb') as any
        webInstance.value.addEventListener('dom-ready', () => {
            console.log('dom-ready')
            window.$mapi.event.callPage('main', 'doRefreshUserInfo')
        });
    })
});


</script>

<template>
    <div v-if="!!webUrl">
        <webview id="userWeb" :src="webUrl" class="pb-user"></webview>
    </div>
</template>

<style lang="less" scoped>
.pb-user {
    width: 100%;
    height: calc(100vh - 2.5rem);
}
</style>
