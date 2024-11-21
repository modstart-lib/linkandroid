<script setup lang="ts">

import {changeLocale, getLocale, listLocales, t} from "../../lang";
import {useSettingStore} from "../../store/modules/setting";
import {onMounted, ref} from "vue";

const locale = ref('')

onMounted(async () => {
    locale.value = await getLocale()
})

const setting = useSettingStore()
const locales = ref(listLocales())
const onLocaleChange = (value: string) => {
    changeLocale(value)
    locale.value = value as any
}
</script>

<template>
    <a-form :model="{}" layout="vertical">
        <a-form-item field="name" :label="t('语言')">
            <a-select :model-value="locale as string"
                      @change="onLocaleChange as any">
                <a-option v-for="(l,lIndex) in locales"
                          :key="l.name"
                          :value="l.name">{{ l.label }}
                </a-option>
            </a-select>
        </a-form-item>
        <a-form-item field="name" :label="t('主题样式')">
            <a-radio-group :model-value="setting.configGet('darkMode').value"
                           @change="setting.onConfigChange('darkMode',$event)">
                <a-radio value="light">{{ t('明亮') }}</a-radio>
                <a-radio value="dark">{{ t('暗黑') }}</a-radio>
                <a-radio value="auto">{{ t('跟随系统') }}</a-radio>
            </a-radio-group>
        </a-form-item>
        <a-form-item field="name" :label="t('点击关闭时')">
            <a-radio-group :model-value="setting.configGet('exitMode').value"
                           @change="setting.onConfigChange('exitMode',$event)">
                <a-radio value="exit">{{ t('直接退出') }}</a-radio>
                <a-radio value="hide">{{ t('隐藏窗口') }}</a-radio>
                <a-radio value="">{{ t('每次询问') }}</a-radio>
            </a-radio-group>
        </a-form-item>
    </a-form>
</template>

<style scoped>

</style>
