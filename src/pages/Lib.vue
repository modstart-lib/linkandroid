<script setup lang="ts">
import {LibPanel} from "../module/Lib";
import {t} from "../lang";
import {Package} from "lucide-vue-next";
</script>

<template>
    <div class="h-full overflow-y-auto p-5" style="height: calc(100vh - var(--window-header-height))">
        <div class="flex justify-between items-center mb-3">
            <div class="flex items-center gap-3">
                <Package class="w-6 h-6"/>
                <h1 class="text-2xl font-bold">{{ t("nav.lib") }}</h1>
            </div>
        </div>
        <LibPanel/>
    </div>
</template>
