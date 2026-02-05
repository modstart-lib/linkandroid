<script setup lang="ts">
import { Package, Settings, Trash2 } from "lucide-vue-next";
import { t } from "../../lang";
import { LibItem } from "./types";

const props = defineProps<{
    item: LibItem;
}>();

const emit = defineEmits<{
    (e: 'setting', item: LibItem): void;
    (e: 'delete', item: LibItem): void;
}>();
</script>

<template>
    <div
        class="p-4 bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg border border-gray-100 dark:border-gray-800 transition-all duration-200"
    >
        <div class="flex justify-between items-start">
            <!-- Left: Component Info -->
            <div class="flex items-start gap-4">
                <div
                    class="flex items-center justify-center w-12 h-12 bg-blue-50 dark:bg-blue-900/30 rounded-lg flex-shrink-0"
                >
                    <Package class="w-6 h-6 text-blue-500" />
                </div>
                <div>
                    <div class="font-semibold text-lg mb-1">{{ item.name }}</div>
                    <div class="text-sm text-gray-600 dark:text-gray-400 mb-1">
                        {{ t("page.lib.version") }}: {{ item.version }}
                    </div>
                    <div class="text-sm text-gray-500 dark:text-gray-500">
                        {{ t("page.lib.path") }}: {{ item.path }}
                    </div>
                </div>
            </div>

            <!-- Right: Action Buttons -->
            <div class="flex gap-2">
                <a-button @click="emit('setting', item)">
                    <template #icon>
                        <Settings class="w-4 h-4" />
                    </template>
                    {{ t("page.lib.settings") }}
                </a-button>
                <a-button status="danger" @click="emit('delete', item)">
                    <template #icon>
                        <Trash2 class="w-4 h-4" />
                    </template>
                    {{ t("page.lib.delete") }}
                </a-button>
            </div>
        </div>
    </div>
</template>
