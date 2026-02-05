<script setup lang="ts">
import { Package, Plus, ShoppingCart } from "lucide-vue-next";
import { ref } from "vue";
import { AppConfig } from "../../config";
import { t } from "../../lang";
import AddComponentDialog from "./AddComponentDialog.vue";
import ComponentItem from "./ComponentItem.vue";
import { LibItem } from "./types";

// Dialog visibility control
const addDialogVisible = ref(false);

// Mock data for dependencies
const libs = ref<LibItem[]>([
    {
        id: "1",
        name: "FFmpeg",
        version: "6.0.0",
        path: "/usr/local/bin/ffmpeg",
    },
    {
        id: "2",
        name: "Python",
        version: "3.11.5",
        path: "/usr/local/bin/python3",
    },
    {
        id: "3",
        name: "Appium",
        version: "2.0.1",
        path: "/usr/local/lib/node_modules/appium",
    },
    {
        id: "3",
        name: "Appium",
        version: "2.0.1",
        path: "/usr/local/lib/node_modules/appium",
    },
    {
        id: "3",
        name: "Appium",
        version: "2.0.1",
        path: "/usr/local/lib/node_modules/appium",
    },
]);

// Show add dialog
const showAddDialog = () => {
    addDialogVisible.value = true;
};

// Open component market
const openMarket = () => {
    window.open(AppConfig.libUrl, '_blank');
};

// Settings for a component (placeholder)
const doSetting = (lib: LibItem) => {
    console.log("Settings for:", lib);
    // TODO: Implement settings dialog
};

// Delete a component (placeholder)
const doDelete = (lib: LibItem) => {
    console.log("Delete:", lib);
    // TODO: Implement delete confirmation
};
</script>

<template>
    <div class="flex mb-3">
        <div class="flex-grow">
            <a-button>
                <template #icon>
                    <icon-refresh />
                </template>
                刷新
            </a-button>
        </div>
        <div class="flex gap-2">
            <a-button @click="openMarket">
                <template #icon>
                    <ShoppingCart class="w-4 h-4"/>
                </template>
                {{ t("page.lib.browseMarket") }}
            </a-button>
            <a-button type="primary" @click="showAddDialog">
                <template #icon>
                    <Plus class="w-4 h-4"/>
                </template>
                {{ t("page.lib.add") }}
            </a-button>
        </div>
    </div>

    <!-- Component List -->
    <div class="flex flex-col gap-4">
        <ComponentItem
            v-for="lib in libs"
            :key="lib.id"
            :item="lib"
            @setting="doSetting"
            @delete="doDelete"
        />
    </div>

    <!-- Empty State -->
    <div v-if="libs.length === 0" class="text-center py-16">
        <Package class="w-16 h-16 mx-auto mb-4 text-gray-400"/>
        <div class="text-gray-500 mb-4">{{ t("page.lib.empty") }}</div>
        <div class="flex justify-center gap-2">
            <a-button type="primary" @click="showAddDialog">
                <template #icon>
                    <Plus class="w-4 h-4"/>
                </template>
                {{ t("page.lib.addFirst") }}
            </a-button>
            <a-button @click="openMarket">
                <template #icon>
                    <ShoppingCart class="w-4 h-4"/>
                </template>
                {{ t("page.lib.browseMarket") }}
            </a-button>
        </div>
    </div>
    <AddComponentDialog v-model:visible="addDialogVisible"/>
</template>
