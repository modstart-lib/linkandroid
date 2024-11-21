<script setup lang="ts">
import {computed} from 'vue'
import {useRouter} from 'vue-router'
import {AppConfig} from "../config";
import {useUserStore} from "../store/modules/user";
import {t} from "../lang";
import {useSettingStore} from "../store/modules/setting";

const route = useRouter()
const user = useUserStore()
const setting = useSettingStore()

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

const userTip = computed(() => {
    return user.user.id ? user.user.name : t('未登录')
})

const doUser = async () => {
    if (!setting.basic.userEnable) {
        return
    }
    await window.$mapi.user.open()
}

</script>

<template>
    <div class="flex flex-col h-full border-r border-gray-200 dark:border-gray-700">
        <div class="py-4 px-3 " :class="setting.basic.userEnable?'cursor-pointer':''" @click="doUser">
            <a-tooltip v-if="setting.basic.userEnable"
                       :content="userTip as string" position="right">
                <img v-if="!user.isInit||!user.user.id"
                     class="rounded-full border border-solid border-gray-200"
                     src="./../assets/image/avatar.svg"/>
                <img v-else :src="user.user.avatar as string"
                     class="rounded-full border border-solid border-gray-200"/>
            </a-tooltip>
            <div v-else>
                <img v-if="!user.isInit||!user.user.id"
                     class="rounded-full border border-solid border-gray-200"
                     src="./../assets/image/avatar.svg"/>
                <img v-else :src="user.user.avatar as string"
                     class="rounded-full border border-solid border-gray-200"/>
            </div>
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
