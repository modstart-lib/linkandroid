<script setup lang="ts">
import {onBeforeUnmount, onMounted, ref} from "vue";
import {t} from "../lang";
import {TabContentScroller} from "../lib/ui";
import SettingBasic from "../components/Setting/SettingBasic.vue";
import SettingEnv from "../components/Setting/SettingEnv.vue";
import SettingAbout from "../components/Setting/SettingAbout.vue";

let tabContentScroller: TabContentScroller | null = null;
const contentContainer = ref<HTMLElement | null>(null);
const tabContainer = ref<HTMLElement | null>(null);
onMounted(() => {
    tabContentScroller = new TabContentScroller(
        tabContainer.value as HTMLElement,
        contentContainer.value as HTMLElement,
        {
            activeClass: "menu-active",
        }
    );
});
onBeforeUnmount(() => {
    tabContentScroller?.destroy();
});
</script>

<style lang="less" scoped>
.menu-active {
    --tw-bg-opacity: 1;
    background-color: rgb(243 244 246 / var(--tw-bg-opacity));
}

[data-theme="dark"] {
    .menu-active {
        background-color: var(--color-bg-page-nav-active);
    }
}
</style>

<template>
    <div class="flex select-none">
        <div
            ref="tabContainer"
            class="p-6 w-56 flex-shrink-0 border-r border-solid border-gray-100 dark:border-gray-800"
        >
            <div data-section="basic" class="p-2 rounded-lg mb-4 cursor-pointer menu-active">
                <div class="text-base">
                    <icon-settings />
                    {{ t("基础设置") }}
                </div>
            </div>
            <div data-section="env" class="p-2 rounded-lg mb-4 cursor-pointer">
                <div class="text-base">
                    <icon-code />
                    {{ t("环境设置") }}
                </div>
            </div>
            <div data-section="about" class="p-2 rounded-lg mb-4 cursor-pointer">
                <div class="text-base">
                    <icon-user />
                    {{ t("关于软件") }}
                </div>
            </div>
        </div>
        <div class="flex-grow">
            <div
                ref="contentContainer"
                class="overflow-y-auto p-8 leading-8"
                style="height: calc(100vh - var(--window-header-height))"
            >
                <div data-section="basic" class="scroll-mt-4">
                    <div class="text-base font-bold mb-4">{{ t("基础设置") }}</div>
                    <div>
                        <SettingBasic />
                    </div>
                </div>
                <div class="border-b border-solid border-gray-200 dark:border-gray-800 my-6"></div>
                <div data-section="env" class="scroll-mt-4">
                    <div class="text-base font-bold mb-4">{{ t("环境设置") }}</div>
                    <div>
                        <SettingEnv />
                    </div>
                </div>
                <div class="border-b border-solid border-gray-200 dark:border-gray-800 my-6"></div>
                <div data-section="about" class="scroll-mt-4">
                    <div class="text-base font-bold mb-4">
                        {{ t("关于软件") }}
                    </div>
                    <div class="">
                        <SettingAbout />
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
