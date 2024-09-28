<script setup lang="ts">
import {computed} from 'vue'
import {useRouter} from 'vue-router'
import {AppConfig} from "../config";
import {useUserStore} from "../store/modules/user";

const route = useRouter()
const user = useUserStore()

const activeTab = computed(() => {
    switch (route.currentRoute.value.path) {
        case '/home':
            return 'home'
        case '/device':
            return 'device'
        case '/setting':
            return 'setting'
    }
})

const doUser = async () => {
    if (!AppConfig.userEnable) {
        return
    }
    await window.$mapi.user.open()
}

</script>

<template>
    <div class="page-nav-container flex flex-col h-full">
        <div class="py-4 px-3 cursor-pointer"
             @click="doUser">
            <img v-if="!user.isInit||!user.user.id" class="rounded-full border border-solid border-gray-200"
                 src="./../assets/image/avatar.svg"/>
            <img v-else :src="user.user.avatar as string" class="rounded-full border border-solid border-gray-200"/>
        </div>
        <div class="flex-grow mt-2">
            <a class="page-nav-item block text-center py-3"
               :class="activeTab==='device'?'active':''"
               @click="$router.push('/device')"
               href="javascript:;">
                <div>
                    <icon-mobile class="text-xl"/>
                </div>
                <div class="text-sm">{{ $t('设备') }}</div>
            </a>
            <a class="page-nav-item block text-center py-3"
               :class="activeTab==='setting'?'active':''"
               @click="$router.push('/setting')"
               href="javascript:;">
                <div>
                    <icon-settings class="text-xl"/>
                </div>
                <div class="text-sm">{{ $t('设置') }}</div>
            </a>
        </div>
        <div>
        </div>
    </div>
</template>

<style scoped>

</style>
