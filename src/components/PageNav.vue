<script setup lang="ts">
import {computed} from 'vue'
import {useRouter} from 'vue-router'

const route = useRouter()

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
</script>

<template>
    <div class="page-nav-container flex flex-col h-full">
        <div class="py-4 px-3 cursor-pointer">
            <img src="./../assets/image/avatar.svg"/>
        </div>
        <div class="flex-grow mt-2">
            <a class="page-nav-item block text-center py-3"
               :class="activeTab==='device'?'active':''"
               @click="$router.push('/device')"
               href="javascript:;">
                <div>
                    <icon-mobile class="text-xl"/>
                </div>
                <div class="text-sm">{{ $t('device') }}</div>
            </a>
            <a class="page-nav-item block text-center py-3"
               :class="activeTab==='setting'?'active':''"
               @click="$router.push('/setting')"
               href="javascript:;">
                <div>
                    <icon-settings class="text-xl"/>
                </div>
                <div class="text-sm">{{ $t('setting') }}</div>
            </a>
        </div>
        <div>
        </div>
    </div>
</template>

<style scoped>

</style>
