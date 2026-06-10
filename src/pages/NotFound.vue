<script setup lang="ts">
import {onMounted} from 'vue'
import {useRoute} from 'vue-router'

const route = useRoute()

onMounted(() => {
    // 在自动化测试模式下，404 必须作为 error 输出，让测试感知
    if (window.__TEST_MODE__) {
        console.error(`[test:404] 路由未匹配，路径: ${route.fullPath}`)
    }
})
</script>

<template>
    <div class="flex flex-col items-center justify-center min-h-screen text-gray-400">
        <div class="text-6xl font-bold mb-4">404</div>
        <div class="text-lg">页面不存在：{{ $route.fullPath }}</div>
    </div>
</template>
