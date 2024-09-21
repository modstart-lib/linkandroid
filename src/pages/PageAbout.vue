<script setup lang="ts">

import {AppConfig} from "../config";
</script>

<template>
    <div>
        {{ AppConfig.name }}
        v{{ AppConfig.version }}
    </div>
</template>

<style scoped>

</style>
