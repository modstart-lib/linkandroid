<script setup lang="ts">
import {onBeforeUnmount, onMounted, ref} from 'vue'
import {changeLocale, getLocale, listLocales, t} from '../../lang'
import {useSettingStore} from '../../store/modules/setting'
import {testActionSet, testActionUnset} from '../../utils/test'

const locale = ref('')

onMounted(async () => {
    locale.value = await getLocale()
    testActionSet('setting.basic.locale', (value: string) => onLocaleChange(value))
    testActionSet('setting.basic.theme', (value: string) => setting.onConfigChange('darkMode', value))
    testActionSet('setting.basic.exitMode', (value: string) => setting.onConfigChange('exitMode', value))
})

onBeforeUnmount(() => {
    testActionUnset('setting.basic.locale')
    testActionUnset('setting.basic.theme')
    testActionUnset('setting.basic.exitMode')
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
        <a-form-item field="name" :label="t('common.language')">
            <a-select :model-value="locale as string" @change="onLocaleChange as any">
                <a-option v-for="(l, lIndex) in locales" :key="l.name" :value="l.name">{{ l.label }} </a-option>
            </a-select>
        </a-form-item>
        <a-form-item field="name" :label="t('setting.themeStyle')">
            <a-radio-group
                :model-value="setting.configGet('darkMode').value"
                @change="setting.onConfigChange('darkMode', $event)"
            >
                <a-radio value="light">{{ t('theme.light') }}</a-radio>
                <a-radio value="dark">{{ t('theme.dark') }}</a-radio>
                <a-radio value="auto">{{ t('setting.followSystem') }}</a-radio>
            </a-radio-group>
        </a-form-item>
        <a-form-item field="name" :label="t('setting.onClose')">
            <a-radio-group
                :model-value="setting.configGet('exitMode').value"
                @change="setting.onConfigChange('exitMode', $event)"
            >
                <a-radio value="exit">{{ t('setting.exitDirectly') }}</a-radio>
                <a-radio value="hide">{{ t('common.hideWindow') }}</a-radio>
                <a-radio value="">{{ t('setting.askEveryTime') }}</a-radio>
            </a-radio-group>
        </a-form-item>
    </a-form>
</template>

<style scoped></style>
