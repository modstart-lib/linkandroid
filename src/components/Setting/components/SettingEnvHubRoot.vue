<script setup lang="ts">

import {t} from "../../../lang";
import {onMounted, ref} from "vue";
import {Dialog} from "../../../lib/dialog";

const env = ref({
    hubRoot: null as string | null,
    hubRootDefault: null as string | null,
})
const doLoad = async () => {
    env.value.hubRoot = await window.$mapi.config.get('hubRoot', '')
    env.value.hubRootDefault = await window.$mapi.file.hubRootDefault()
}

onMounted(doLoad)

const doSelectHubRootPath = async (useDefault: boolean) => {
    let dir
    if (useDefault) {
        dir = await window.$mapi.file.hubRootDefault()
    } else {
        dir = await window.$mapi.file.openDirectory()
    }
    if (dir) {
        Dialog.confirm(t('确认修改存储路径为 {path} ？', {path: dir})).then(() => {
            window.$mapi.config.set('hubRoot', dir).then(() => {
                window.$mapi.app.quit()
            })
        })
    }
}

</script>

<template>
    <a-form-item field="name" :label="t('文件存储路径')">
        <a-input
            readonly
            :placeholder="env.hubRootDefault as string"
            v-model="env.hubRoot as string">
            <template #append>
                <div @click="doSelectHubRootPath(true)"
                     v-if="env.hubRoot && env.hubRoot !== env.hubRootDefault"
                     class="cursor-pointer border-r-1 border-gray-300 border-solid pr-3">
                    {{ t('使用默认') }}
                </div>
                <div @click="doSelectHubRootPath(false)"
                     class="cursor-pointer">
                    {{ t('选择路径') }}
                </div>
            </template>
        </a-input>
        <template #help>
            <div class="pt-3 text-xs text-red-500">
                {{ t('修改存储路径需要重启软件') }}
            </div>
        </template>
    </a-form-item>
</template>

<style scoped>

</style>
