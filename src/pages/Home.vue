<script setup lang="ts">
import {onBeforeMount, onMounted, ref} from "vue";
import Router from "../router";
import {AppConfig} from "../config";

const loading = ref(true);
onMounted(async () => {
    loading.value = false;
});

onBeforeMount(() => {
    Router.push("/device");
});
</script>

<template>
    <div class="page-narrow-container p-8">
        <div class="text-3xl font-bold mb-4">欢迎使用 {{ AppConfig.name }} ！</div>
        <div></div>
    </div>
</template>
