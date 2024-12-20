<script setup lang="ts">

import {AppConfig} from "../config";
import {t} from "../lang";
import UpdaterButton from "../components/common/UpdaterButton.vue";
import {useSettingStore} from "../store/modules/setting";

const setting = useSettingStore()
const licenseYear = new Date().getFullYear()

const doOpenLog = async () => {
    await window.$mapi.file.openPath(window.$mapi.log.root())
}
</script>

<template>
    <div class="flex" style="height:calc(100vh - 2.5rem);">
        <div class="p-4 m-auto">
            <div class="flex mb-3 items-center">
                <div class="w-20">{{ t('版本') }}</div>
                <div class="flex-grow">
                    <div class="inline-block">
                        v{{ AppConfig.version }}
                        Build {{ setting.buildInfo.buildId }}
                    </div>
                </div>
                <div class="inline-block ml-3">
                    <UpdaterButton/>
                </div>
            </div>
            <div class="flex mb-3 items-center">
                <div class="w-20">{{ t('官网') }}</div>
                <div class="flex-grow">
                    <a :href="AppConfig.website" target="_blank"
                       class="text-link">
                        {{ AppConfig.website }}
                    </a>
                </div>
                <div>
                    <a :href="AppConfig.feedbackUrl"
                       target="_blank"
                       class="align-top arco-btn arco-btn-secondary arco-btn-shape-square arco-btn-size-medium arco-btn-status-normal ml-3">
                        <icon-customer-service class="mr-1"/>
                        {{ t('使用反馈') }}
                    </a>
                    <a-button class="ml-3"
                              @click="doOpenLog">
                        <template #icon>
                            <icon-file/>
                        </template>
                        {{ t('日志') }}
                    </a-button>
                </div>
            </div>
            <div class="flex mb-3 items-center">
                <div class="w-20">{{ t('声明') }}</div>
                <div class="flex-grow">
                    {{ t('本产品为开源软件，遵循 AGPL-3.0 license 协议。') }}
                </div>
            </div>
            <div class="mb-3 flex items-center">
                <a :href="AppConfig.websiteGithub"
                   target="_blank"
                   class="bg-gray-100 dark:bg-gray-700 w-0 flex-grow mr-1 rounded-lg py-2 px-8 inline-flex items-center hover:shadow-lg">
                    <img src="./../assets/image/github.svg" class="w-12 h-12 mr-2 object-contain"/>
                    <div class="flex-grow">Github</div>
                </a>
                <a :href="AppConfig.websiteGitee"
                   target="_blank"
                   class="bg-gray-100 dark:bg-gray-700 w-0 flex-grow mr-1 rounded-lg py-2 px-8 inline-flex items-center hover:shadow-lg">
                    <img src="./../assets/image/gitee.svg" class="w-12 h-12 mr-2 object-contain"/>
                    <div class="flex-grow">Gitee</div>
                </a>
            </div>
            <div class="text-gray-400 text-center">
                &copy; {{ licenseYear }} {{ AppConfig.name }}
            </div>
        </div>
    </div>
</template>

<style scoped>

</style>
