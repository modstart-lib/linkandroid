<script setup lang="ts">
import { FolderOpen, ShoppingCart } from "lucide-vue-next";
import { ref } from "vue";
import { t } from "../../lang";

const visible = defineModel<boolean>("visible", {default: false});

// Local directory path
const localPath = ref("");

const close = () => {
    visible.value = false;
    localPath.value = "";
};

const browseLocalDirectory = () => {
    // TODO: Implement file dialog
    console.log("Browse local directory");
};

const addFromLocal = () => {
    // TODO: Implement add logic
    console.log("Add from local:", localPath.value);
};

const openMarket = () => {
    // TODO: Implement market navigation
    console.log("Open component market");
};
</script>

<template>
    <a-modal
        v-model:visible="visible"
        width="800px"
        title-align="start"
        @cancel="close"
        modal-class="component-modal"
    >
        <template #title>
            {{ t("page.lib.addComponent") }}
        </template>
        <template #footer>
            <a-button @click="close">{{ t("common.close") }}</a-button>
            <a-button type="primary">{{ t("common.submit") }}</a-button>
        </template>
        <div class="flex flex-col h-full rounded-lg overflow-hidden bg-white dark:bg-gray-900">
            <div class="flex flex-col md:flex-row gap-6">
                <div
                    class="w-full md:w-1/2 flex flex-col bg-gray-50 dark:bg-gray-800/50 rounded-xl p-5 border border-gray-100 dark:border-gray-700/50">
                    <div class="flex items-center gap-2 mb-4">
                        <FolderOpen class="w-5 h-5 text-blue-500"/>
                        <h3 class="font-bold text-base text-gray-800 dark:text-gray-200">
                            {{ t("page.lib.localComponent") }}
                        </h3>
                    </div>

                    <div class="flex-grow flex flex-col items-center justify-center text-center py-6">
                        <div
                            class="w-16 h-16 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center mb-4 shadow-sm">
                            <FolderOpen class="w-8 h-8 text-blue-500"/>
                        </div>
                        <div class="mb-6 text-sm text-gray-500 dark:text-gray-400 px-4 leading-relaxed">
                            {{ t("page.lib.localComponentDesc") }}
                        </div>

                        <a-button type="outline" long @click="browseLocalDirectory"
                                  class="rounded-lg bg-white dark:bg-transparent border-blue-500 text-blue-600 dark:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20">
                            <template #icon>
                                <FolderOpen class="w-4 h-4"/>
                            </template>
                            {{ t("page.lib.selectConfig") }}
                        </a-button>
                    </div>
                </div>
                <div
                    class="w-full md:w-1/2 flex flex-col bg-blue-50 dark:bg-blue-900/10 rounded-xl p-5 border border-blue-100 dark:border-blue-800/20">
                    <div class="flex items-center gap-2 mb-4">
                        <ShoppingCart class="w-5 h-5 text-green-500"/>
                        <h3 class="font-bold text-base text-gray-800 dark:text-gray-200">
                            {{ t("page.lib.componentMarket") }}
                        </h3>
                    </div>

                    <div class="flex-grow flex flex-col items-center justify-center text-center py-6">
                        <div
                            class="w-16 h-16 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center mb-4 shadow-sm">
                            <ShoppingCart class="w-8 h-8 text-green-500"/>
                        </div>
                        <div class="mb-6 text-sm text-gray-600 dark:text-gray-400 px-4 leading-relaxed">
                            {{ t("page.lib.marketDesc") }}
                        </div>

                        <a-button type="outline" long @click="openMarket"
                                  class="rounded-lg bg-white dark:bg-transparent border-green-500 text-green-600 dark:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20">
                            <template #icon>
                                <ShoppingCart class="w-4 h-4"/>
                            </template>
                            {{ t("page.lib.browseMarket") }}
                        </a-button>
                    </div>
                </div>
            </div>
        </div>
    </a-modal>
</template>

<style scoped>
/* Optional: specific overrides if Tailwind isn't enough for Arco components */
:deep(.arco-modal-body) {
    padding: 0;
}
</style>
