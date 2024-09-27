<script setup lang="ts">

import {AppConfig} from "../config";
</script>

<template>
    <div>
        <webview :src="AppConfig.userUrl" class="pb-user"></webview>
    </div>
</template>

<style lang="less" scoped>
.pb-user {
    width: 100%;
    height: calc(100vh - 2.5rem);
}
</style>
