<script setup lang="ts">
import {ref} from "vue";
import {Dialog} from "../../lib/dialog";
import {AppConfig} from "../../config";
import {t} from "../../lang";
import {defaultResponseProcessor} from "../../lib/api";
import {VersionUtil} from "../../lib/util";

const updaterCheckLoading = ref(false)

const doVersionCheck = () => {
    updaterCheckLoading.value = true
    window.$mapi.updater.checkForUpdate().then(res => {
        updaterCheckLoading.value = false
        defaultResponseProcessor(res, (res: ApiResult<any>) => {
            if (!res.data.version) {
                Dialog.tipError(t('检测更新失败'))
                return
            }
            if (VersionUtil.le(res.data.version, AppConfig.version)) {
                Dialog.tipSuccess(t('已经是最新版本'))
                return
            }
            Dialog.confirm(t('发现新版本{version}，是否立即下载更新？', {version: res.data.version}))
                .then(() => {
                    window.$mapi.app.openExternalWeb(AppConfig.downloadUrl)
                })
        })
    })
}
</script>

<template>
    <a-button v-if="!!AppConfig.updaterUrl"
              size="mini"
              :loading="updaterCheckLoading"
              @click="doVersionCheck()">
        {{ $t('检测更新') }}
    </a-button>
</template>
