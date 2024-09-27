<script setup lang="ts">
import {onBeforeUnmount, onMounted, ref} from 'vue'
import {AppConfig} from "../config";
import {changeLocale, getLocale, listLocales, t} from '../lang'
import UpdaterButton from "../components/common/UpdaterButton.vue";
import {TabContentScroller} from "../lib/ui";

const locales = ref(listLocales())
const common = ref({
    locale: null as string | null,
    adbPath: null as string | null,
    scrcpyPath: null as string | null,
})
const doLoad = async () => {
    common.value.adbPath = await window.$mapi.adb.getBinPath()
    common.value.scrcpyPath = await window.$mapi.scrcpy.getBinPath()
}

onMounted(doLoad)

const doAdbPathChange = async (value: string) => {
    await window.$mapi.adb.setBinPath(value)
    await doLoad()
}
const doSelectAdbPath = async () => {
    const adbPath = await window.$mapi.file.openFile()
    if (adbPath) {
        await doAdbPathChange(adbPath)
    }
}
const doScrcpyPathChange = async (value: string) => {
    await window.$mapi.scrcpy.setBinPath(value)
    await doLoad()
}
const doSelectScrcpyPath = async () => {
    const scrcpyPath = await window.$mapi.file.openFile()
    if (scrcpyPath) {
        await doScrcpyPathChange(scrcpyPath)
    }
}

let tabContentScroller: TabContentScroller | null = null
const contentContainer = ref<HTMLElement | null>(null)
const tabContainer = ref<HTMLElement | null>(null)
onMounted(() => {
    tabContentScroller = new TabContentScroller(
        tabContainer.value as HTMLElement,
        contentContainer.value as HTMLElement,
        {
            activeClass: 'bg-gray-100'
        }
    )
})
onBeforeUnmount(() => {
    tabContentScroller?.destroy()
})

onMounted(async () => {
    common.value.locale = await getLocale()
})
const onLocaleChange = (value: string) => {
    changeLocale(value)
    common.value.locale = value as any
}


</script>

<template>
    <div class="flex">
        <div ref="tabContainer"
             class="p-8 w-56 flex-shrink-0 border-r border-solid border-gray-100">
            <div data-section="common" class="p-2 rounded-lg mr-2 mb-4 cursor-pointer bg-gray-100">
                <div class="text-base">
                    <icon-settings/>
                    {{ t('基础设置') }}
                </div>
            </div>
            <div data-section="about" class="p-2 rounded-lg mr-2 mb-4 cursor-pointer">
                <div class="text-base">
                    <icon-user/>
                    {{ t('关于软件') }}
                </div>
            </div>
        </div>
        <div class="flex-grow">
            <div ref="contentContainer"
                 class="overflow-y-auto p-8 leading-8"
                 style="height:calc(100vh - var(--window-header-height));">
                <div data-section="common" class="scroll-mt-4">
                    <div class="text-base font-bold mb-4">
                        {{ t('基础设置') }}
                    </div>
                    <div>
                        <a-form :model="common" layout="vertical">
                            <a-form-item field="name" :label="t('ADB路径')">
                                <a-input
                                    @change="doAdbPathChange"
                                    v-model="common.adbPath as string">
                                    <template #append>
                                        <span @click="doSelectAdbPath"
                                              class="cursor-pointer">
                                            {{ t('选择路径') }}
                                        </span>
                                    </template>
                                </a-input>
                            </a-form-item>
                            <a-form-item field="name" :label="t('scrcpy路径')">
                                <a-input
                                    @change="doScrcpyPathChange"
                                    v-model="common.scrcpyPath as string">
                                    <template #append>
                                        <span @click="doSelectScrcpyPath"
                                              class="cursor-pointer">
                                            {{ t('选择路径') }}
                                        </span>
                                    </template>
                                </a-input>
                            </a-form-item>
                            <a-form-item field="name" :label="t('语言')">
                                <a-select :model-value="common.locale as string"
                                          @change="onLocaleChange as any">
                                    <a-option v-for="(l,lIndex) in locales"
                                              :key="l.name"
                                              :value="l.name">{{ l.label }}
                                    </a-option>
                                </a-select>
                            </a-form-item>
                        </a-form>
                    </div>
                </div>
                <div class="border-b border-solid border-gray-200 my-6"></div>
                <div data-section="about" class="scroll-mt-4">
                    <div class="text-base font-bold mb-4">
                        {{ t('关于软件') }}
                    </div>
                    <div class="">
                        <div class="flex mb-3">
                            <div class="w-20">{{ t('版本') }}</div>
                            <div class="flex-grow">
                                <div class="inline-block">
                                    v{{ AppConfig.version }}
                                </div>
                                <div class="inline-block ml-3">
                                    <UpdaterButton/>
                                </div>
                            </div>
                        </div>
                        <div class="flex mb-3">
                            <div class="w-20">{{ t('声明') }}</div>
                            <div class="flex-grow">
                                {{ t('本产品为开源软件，遵循 GPL-3.0 license 协议。') }}
                            </div>
                        </div>
                        <div class="flex mb-3">
                            <div class="w-20">{{ t('反馈') }}</div>
                            <div class="flex-grow">
                                <a :href="AppConfig.website" target="_blank"
                                   class="text-link">
                                    {{ AppConfig.website }}
                                </a>
                            </div>
                        </div>
                        <div class="flex mb-3">
                            <div class="w-20">{{ t('官网') }}</div>
                            <div class="flex-grow">
                                <a :href="AppConfig.website" target="_blank"
                                   class="text-link">
                                    {{ AppConfig.website }}
                                </a>
                            </div>
                        </div>
                        <div class="mb-3">
                            <a :href="AppConfig.websiteGithub"
                               target="_blank"
                               class="bg-gray-100 mr-1 rounded-lg py-2 px-8 inline-flex items-center mb-3 hover:shadow-lg">
                                <img src="./../assets/image/github.svg" class="w-12 h-12 mr-2"/>
                                <div class="flex-grow">Github</div>
                            </a>
                            <a :href="AppConfig.websiteGitee"
                               target="_blank"
                               class="bg-gray-100 mr-1 rounded-lg py-2 px-8 inline-flex items-center hover:shadow-lg">
                                <img src="./../assets/image/gitee.svg" class="w-12 h-12 mr-2"/>
                                <div class="flex-grow">Gitee</div>
                            </a>
                        </div>
                        <div class="text-gray-400">
                            &copy; 2024 {{ AppConfig.name }}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
