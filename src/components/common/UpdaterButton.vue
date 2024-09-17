<script setup lang="ts">
import {ref} from "vue";
import {Dialog} from "../../lib/dialog";
import {AppConfig} from "../../config";
import {i18nTrans} from "../../lang";

const updaterCheckLoading = ref(false)

type VersionDownloadCallback = Parameters<typeof window.$mapi.updater.downloadUpdate>[0];
const versionDownloadCallback: VersionDownloadCallback = (type, data) => {
    if ('error' === type) {
        Dialog.tipError(i18nTrans('updater.download.failed'))
    } else if ('progress' === type) {
        // Dialog.tipSuccess(`下载进度：${data.percent}%`)
        Dialog.tipSuccess(i18nTrans('updater.download.progress', {percent: data.percent}))
    } else if ('downloaded' === type) {
        Dialog.confirm(i18nTrans('updater.download.end')).then(() => {
            window.$mapi.updater.quitAndInstall()
        })
    }
}
type CheckForUpdateCallback = Parameters<typeof window.$mapi.updater.checkForUpdate>[0];
const versionCheckCallback: CheckForUpdateCallback = (type, data) => {
    if ('checking' !== type) {
        updaterCheckLoading.value = false
    }
    if ('error' === type) {
        Dialog.tipError(i18nTrans('updater.checkUpdate.failed'))
    } else if ('available' === type) {
        Dialog.confirm(i18nTrans('updater.checkUpdate.foundNew', {version: data.version})).then(() => {
            window.$mapi.updater.downloadUpdate(versionDownloadCallback)
        })
    } else if ('notAvailable' === type) {
        Dialog.tipSuccess(i18nTrans('updater.checkUpdate.latest'))
    }
}

const doVersionCheck = () => {
    updaterCheckLoading.value = true
    window.$mapi.updater.checkForUpdate(versionCheckCallback)
}
</script>

<template>
    <a-button v-if="!!AppConfig.updaterUrl"
              :loading="updaterCheckLoading"
              @click="doVersionCheck()">
        {{ $t('updater.checkUpdate') }}
    </a-button>
</template>
