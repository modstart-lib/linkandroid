<script setup lang="ts">
import { onMounted, ref } from "vue";
import { AppConfig } from "../config";
import Router from "../router";

const loading = ref(true);

onMounted(async () => {
    // 模拟加载延迟，展示加载界面
    await new Promise(resolve => setTimeout(resolve, 1000));
    loading.value = false;
    Router.push("/device");
});
</script>

<template>
    <div class="page-narrow-container p-8">
        <!-- Loading State -->
        <div class="loading-section" v-if="loading">
            <a-spin />
            <div class="loading-text">正在加载…</div>
        </div>

        <!-- Content State -->
        <div class="content-section" v-else>
            <div class="text-3xl font-bold mb-4">欢迎使用 {{ AppConfig.name }} !</div>
            <div class="empty-state">
                <p class="text-gray-400">主页内容区域</p>
            </div>
        </div>
    </div>
</template>

<style scoped lang="less">
.loading-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 400px;
    gap: 16px;
}

.loading-text {
    font-size: 14px;
    color: #666;
}

.content-section {
    animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
    from {
        opacity: 0;
    }
    to {
        opacity: 1;
    }
}

.empty-state {
    margin-top: 20px;
    padding: 40px;
    text-align: center;
    background: #f5f5f5;
    border-radius: 8px;
}
</style>
