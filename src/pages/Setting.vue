<script setup lang="ts">
import {nextTick, onBeforeUnmount, onMounted, ref} from 'vue'
import SettingAbout from '../components/Setting/SettingAbout.vue'
import SettingBasic from '../components/Setting/SettingBasic.vue'
import SettingCli from '../components/Setting/SettingCli.vue'
import {t} from '../lang'

import {testActionSet, testActionUnset} from '../utils/test'

const activeTab = ref('basic')

onMounted(() => {
    testActionSet('setting.ready', async () => {})
    testActionSet('setting.tab.basic', () => {
        activeTab.value = 'basic'
    })
    
    testActionSet('setting.tab.cli', () => {
        activeTab.value = 'cli'
    })
    testActionSet('setting.tab.about', () => {
        activeTab.value = 'about'
    })
    // 截图钩子：setting-about 截图前切到「关于」页签
    testActionSet('setting-about.prepare', async () => {
        activeTab.value = 'about'
        await nextTick()
    })
})

onBeforeUnmount(() => {
    testActionUnset('setting.ready')
    testActionUnset('setting.tab.basic')
    
    testActionUnset('setting.tab.cli')
    testActionUnset('setting.tab.about')
    testActionUnset('setting-about.prepare')
})
</script>

<style lang="less" scoped>
.setting-tab {
    color: var(--color-text);
    transition:
        background-color 0.2s ease,
        color 0.2s ease;

    &:hover {
        background-color: rgba(0, 0, 0, 0.04);
    }
}

.tab-active {
    background-color: var(--color-bg-page-nav-active);
    color: var(--color-text-page-nav-active);

    &:hover {
        background-color: var(--color-bg-page-nav-active);
    }
}

[data-theme='dark'] {
    .setting-tab:hover {
        background-color: rgba(255, 255, 255, 0.06);
    }
}
</style>

<template>
    <div class="flex select-none">
        <div class="p-6 w-48 flex-shrink-0 border-r border-solid border-gray-100 dark:border-gray-800">
            <div
                class="setting-tab p-2 rounded-lg mb-4 cursor-pointer"
                :class="activeTab === 'basic' ? 'tab-active' : ''"
                @click="activeTab = 'basic'"
            >
                <div class="text-base flex items-center gap-2 whitespace-nowrap">
                    <i-lucide-settings />
                    {{ t('page.setting.basic') }}
                </div>
            </div>
            
            <div
                class="setting-tab p-2 rounded-lg mb-4 cursor-pointer"
                :class="activeTab === 'cli' ? 'tab-active' : ''"
                @click="activeTab = 'cli'"
            >
                <div class="text-base flex items-center gap-2 whitespace-nowrap">
                    <i-lucide-code />
                    {{ t('page.setting.cli') }}
                </div>
            </div>
            <div
                class="setting-tab p-2 rounded-lg mb-4 cursor-pointer"
                :class="activeTab === 'about' ? 'tab-active' : ''"
                @click="activeTab = 'about'"
            >
                <div class="text-base flex items-center gap-2 whitespace-nowrap">
                    <i-lucide-user />
                    {{ t('page.setting.about') }}
                </div>
            </div>
        </div>
        <div class="flex-grow overflow-y-auto" style="height: calc(100vh - var(--window-header-height))">
            <div v-show="activeTab === 'basic'">
                <div class="p-6">
                    <div class="text-2xl font-bold mb-6 flex items-center gap-2">
                        <i-lucide-settings class="text-2xl" />
                        <span>{{ t('page.setting.basic') }}</span>
                    </div>
                    <SettingBasic />
                </div>
            </div>
            
            <div v-show="activeTab === 'cli'">
                <div class="p-6">
                    <div class="text-2xl font-bold mb-6 flex items-center gap-2">
                        <i-lucide-code class="text-2xl" />
                        <span>{{ t('page.setting.cli') }}</span>
                    </div>
                    <SettingCli />
                </div>
            </div>
            <div v-show="activeTab === 'about'">
                <div class="p-6">
                    <div class="text-2xl font-bold mb-6 flex items-center gap-2">
                        <i-lucide-user class="text-2xl" />
                        <span>{{ t('page.setting.about') }}</span>
                    </div>
                    <SettingAbout />
                </div>
            </div>
        </div>
    </div>
</template>
