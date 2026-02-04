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
            <div>{{ $t("device.empty") }}</div>
        </div>
        <div class="mt-10 text-center">
            <a-button class="mx-1" @click="helpShow = true">
                <template #icon>
                    <icon-book class="mr-1"/>
                </template>
                {{ $t("device.howToConnect") }}
            </a-button>
        </div>
        <div v-if="helpShow" class="pt-5 text-center">
            <div class="inline-block bg-gray-100 dark:bg-gray-700 text-left rounded-lg p-4">
                <div>① {{ $t("device.enableUsbDebug") }}</div>
                <div>② {{ $t("device.connectUsb") }}</div>
                <div class="pt-3">
                    {{ $t("device.seeMoreDocs") }}
                    <a href="javascript:;" class="text-link" @click="doHelp">
                        <icon-book/>
                        {{ $t("device.onlineDocs") }}
                    </a>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>

</style>
