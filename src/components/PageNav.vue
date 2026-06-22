<script setup lang="ts">
import {computed, onMounted, onUnmounted} from 'vue'
import {useRouter} from 'vue-router'
import {t} from '../lang'


const route = useRouter()


const activeTab = computed(() => {
    switch (route.currentRoute.value.path) {
        case '/home':
            return 'home'
        case '/device':
            return 'device'
        case '/task':
            return 'task'
        case '/setting':
            return 'setting'
    }
})


</script>

<template>
    <div class="flex flex-col h-full border-r border-gray-200 dark:border-gray-800">
        
        <div class="flex-grow mt-2">
            <a
                class="page-nav-item block text-center py-3"
                :class="activeTab === 'device' ? 'active' : ''"
                @click="$router.push('/device')"
                href="javascript:;"
            >
                <div class="flex justify-center">
                    <i-lucide-smartphone class="text-xl" />
                </div>
                <div class="text-sm">{{ $t('nav.device') }}</div>
            </a>
            <a
                class="page-nav-item block text-center py-3"
                :class="activeTab === 'task' ? 'active' : ''"
                @click="$router.push('/task')"
                href="javascript:;"
            >
                <div class="flex justify-center">
                    <i-lucide-workflow class="text-xl" />
                </div>
                <div class="text-sm">{{ $t('nav.task') }}</div>
            </a>
            <a
                class="page-nav-item block text-center py-3"
                :class="activeTab === 'setting' ? 'active' : ''"
                @click="$router.push('/setting')"
                href="javascript:;"
            >
                <div class="flex justify-center">
                    <i-lucide-settings class="text-xl" />
                </div>
                <div class="text-sm">{{ $t('nav.setting') }}</div>
            </a>
        </div>
        <div></div>
    </div>
</template>

<style scoped></style>
