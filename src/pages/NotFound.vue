<script setup lang="ts">
import {onMounted, onUnmounted} from 'vue'
import {useRoute} from 'vue-router'
import {testActionSet, testActionUnset} from '../utils/test'

const route = useRoute()

onMounted(() => {
    testActionSet('notfound.ready', async () => {})

    // 测试模式下区分真实 404 与测试辅助的主动跳转
    if (window.__TEST_MODE__) {
        // /notfound 是测试辅助函数（test/helpers/actions.ts）用于弹窗隔离的主动导航
        if (route.fullPath === '/notfound') {
            console.log(`[test:404] intentional: ${route.fullPath}`)
        } else {
            console.error(`[test:404] route not matched: ${route.fullPath}`)
        }
    }
})

onUnmounted(() => {
    testActionUnset('notfound.ready')
})
</script>

<template>
    <div class="flex flex-col items-center justify-center min-h-screen text-gray-400">
        <div class="text-6xl font-bold mb-4">404</div>
        <div class="text-lg">{{ $t('page.notFound') }}: {{ $route.fullPath }}</div>
    </div>
</template>
