<script setup lang="ts">
import {onBeforeUnmount, onMounted, ref} from 'vue'
import {changeLocale, getLocale, listLocales, t} from '../../lang'
import {useSettingStore} from '../../store/modules/setting'
import {testActionSet, testActionUnset} from '../../utils/test'

const locale = ref('')

// 实际生效的数据根目录，仅当不是默认目录时在设置中提示用户实际存储位置
const dataRoot = ref({
    isDefault: true,
    path: '',
})

const loadDataRoot = async () => {
    const env = await window.$mapi.app.appEnv()
    dataRoot.value = {
        isDefault: env?.dataRootIsDefault !== false,
        path: env?.dataRoot || '',
    }
}

const doOpenDataRoot = async () => {
    const target = dataRoot.value.path
    if (target) {
        await window.$mapi.app.openPath(target)
    }
}

onMounted(async () => {
    locale.value = await getLocale()
    loadDataRoot().then()
    testActionSet('setting.basic.locale', (value: string) => onLocaleChange(value))
    testActionSet('setting.basic.theme', (value: string) => setting.onConfigChange('darkMode', value))
    testActionSet('setting.basic.exitMode', (value: string) => setting.onConfigChange('exitMode', value))
    testActionSet('setting.basic.openDataRoot', () => doOpenDataRoot())
})

onBeforeUnmount(() => {
    testActionUnset('setting.basic.locale')
    testActionUnset('setting.basic.theme')
    testActionUnset('setting.basic.exitMode')
    testActionUnset('setting.basic.openDataRoot')
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
        <a-form-item v-if="!dataRoot.isDefault" field="dataRoot" :label="t('setting.dataRoot')">
            <a-input readonly :model-value="dataRoot.path">
                <template #append>
                    <div class="cursor-pointer pl-3" @click="doOpenDataRoot">
                        {{ t('common.openPath') }}
                    </div>
                </template>
            </a-input>
            <template #help>
                <div class="text-orange-500">{{ t('setting.dataRootCustomTip') }}</div>
            </template>
        </a-form-item>
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
