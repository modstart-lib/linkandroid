<script setup lang="ts">
import {onMounted, ref} from "vue";
import {t} from "../../lang";

const basic = ref({
    adbPath: null as string | null,
    adbPathDefault: null as string | null,
    scrcpyPath: null as string | null,
    scrcpyPathDefault: null as string | null,
});
const doLoad = async () => {
};

onMounted(doLoad);
</script>

<template>
    <a-form :model="{}" layout="vertical">
        <a-form-item field="name" :label="t('setting.adbPath')">
            <a-input @change="doAdbPathChange"
                     :placeholder="basic.adbPathDefault"
                     v-model="basic.adbPath as string">
                <template #append>
                    <span @click="doSelectAdbPath" class="cursor-pointer">
                        {{ t("common.selectPath") }}
                    </span>
                </template>
            </a-input>
        </a-form-item>
        <a-form-item field="name" :label="t('setting.scrcpyPath')">
            <a-input @change="doScrcpyPathChange"
                     :placeholder="basic.scrcpyPathDefault"
                     v-model="basic.scrcpyPath as string">
                <template #append>
                    <span @click="doSelectScrcpyPath" class="cursor-pointer">
                        {{ t("common.selectPath") }}
                    </span>
                </template>
            </a-input>
        </a-form-item>
    </a-form>
</template>

<style scoped></style>
