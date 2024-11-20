<script setup lang="ts">
import {onBeforeMount, onMounted, ref} from "vue";
import PageNav from "./../components/PageNav.vue";
import {AppConfig} from "../config";
import AppQuitConfirm from "../components/AppQuitConfirm.vue";

const appQuitConfirm = ref<InstanceType<typeof AppQuitConfirm> | null>(null);
const platformName = ref('')

const doQuit = async () => {
    await appQuitConfirm.value?.show()
}

onBeforeMount(() => {
    platformName.value = window.$mapi?.app?.platformName() as any
})

onMounted(() => {
    // document.body.setAttribute('arco-theme', 'dark')
})
</script>
<template>
    <div class="window-container">
        <div class="window-header flex h-10 items-center border-b border-solid border-gray-200">
            <div class="window-header-title flex-grow flex items-center">
                <div class="pl-2 py-2">
                    <img src="/logo.svg" class="w-4 t-4"/>
                </div>
                <div class="p-2 flex-grow">
                    {{ AppConfig.name }}
                </div>
            </div>
            <div class="p-1 leading-4">
                <div class="inline-block w-6 h-6 leading-6 cursor-pointer hover:text-primary mr-1"
                     @click="$mapi.app.windowMin">
                    <i class="iconfont text-sm icon-min"></i>
                </div>
                <div class="inline-block w-6 h-6 leading-6 cursor-pointer hover:text-primary mr-1"
                     @click="$mapi.app.windowMax">
                    <i class="iconfont text-sm icon-max"></i>
                </div>
                <div class="inline-block w-6 h-6 leading-6 cursor-pointer hover:text-red-500"
                     @click="doQuit">
                    <i class="iconfont text-sm icon-close"></i>
                </div>
            </div>
        </div>
        <div class="window-body">
            <div class="page-container flex">
                <div class="w-16 flex-shrink-0 h-full text-white"
                     style="background-color:var(--color-bg-page-nav);">
                    <PageNav/>
                </div>
                <div class="flex-grow overflow-y-auto">
                    <router-view></router-view>
                </div>
            </div>
        </div>
    </div>
    <AppQuitConfirm ref="appQuitConfirm"/>
</template>
