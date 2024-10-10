<script setup lang="ts">

import {t} from "../../lang";
import {onMounted, ref} from "vue";


const basic = ref({
    adbPath: null as string | null,
    scrcpyPath: null as string | null,
})
const doLoad = async () => {
    basic.value.adbPath = await window.$mapi.adb.getBinPath()
    basic.value.scrcpyPath = await window.$mapi.scrcpy.getBinPath()
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


</script>

<template>
    <a-form :model="{}" layout="vertical">
        <a-form-item field="name" :label="t('adb路径')">
            <a-input
                @change="doAdbPathChange"
                v-model="basic.adbPath as string">
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
                v-model="basic.scrcpyPath as string">
                <template #append>
                                        <span @click="doSelectScrcpyPath"
                                              class="cursor-pointer">
                                            {{ t('选择路径') }}
                                        </span>
                </template>
            </a-input>
        </a-form-item>
    </a-form>
</template>

<style scoped>

</style>
