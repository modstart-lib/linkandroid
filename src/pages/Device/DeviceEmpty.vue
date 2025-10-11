<script setup lang="ts">
import {ref} from "vue";
import {AppConfig} from "../../config";

const helpShow = ref(false);

const doHelp = () => {
    window.$mapi.app.openExternal(AppConfig.helpUrl);
};
</script>

<template>
    <div class="py-10">
        <div class="text-center">
            <img class="h-32 m-auto opacity-50" src="./../../assets/image/device-empty.svg"/>
        </div>
        <div class="mt-10 text-center text-lg text-gray-400">
            <div>{{ $t("还没有设备，使用USB连接电脑开始使用～") }}</div>
        </div>
        <div class="mt-10 text-center">
            <a-button class="mx-1" @click="helpShow = true">
                <template #icon>
                    <icon-book class="mr-1"/>
                </template>
                {{ $t("如何连接？") }}
            </a-button>
        </div>
        <div v-if="helpShow" class="pt-5 text-center">
            <div class="inline-block bg-gray-100 dark:bg-gray-700 text-left rounded-lg p-4">
                <div>① {{ $t("打开手机USB调试") }}</div>
                <div>② {{ $t("使用USB连接电脑") }}</div>
                <div class="pt-3">
                    {{ $t("更多内容，请查看") }}
                    <a href="javascript:;" class="text-link" @click="doHelp">
                        <icon-book/>
                        {{ $t("在线文档") }}
                    </a>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>

</style>
