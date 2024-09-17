<template>
    <a-config-provider :locale="locale" :global="true">
        <router-view></router-view>
    </a-config-provider>
</template>

<script setup lang="ts">
import {ref} from "vue";
import {onLocaleChange} from "./lang"

import zhCN from '@arco-design/web-vue/es/locale/lang/zh-cn';
import enUS from '@arco-design/web-vue/es/locale/lang/en-us';

const locales = {
    'zh-CN': zhCN,
    'en-US': enUS,
};

const locale = ref(zhCN);
onLocaleChange((newLocale) => {
    locale.value = locales[newLocale];
});

</script>
