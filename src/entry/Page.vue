<template>
    <a-config-provider :locale="locale" :global="true">
        <div>
            <component :is="props.page"/>
        </div>
    </a-config-provider>
</template>

<script setup lang="ts">
import {ref} from "vue";
import {onLocaleChange} from "../lang"

import zhCN from '@arco-design/web-vue/es/locale/lang/zh-cn';
import enUS from '@arco-design/web-vue/es/locale/lang/en-us';
import PageAbout from "../pages/PageAbout.vue";

const locales = {
    'zh-CN': zhCN,
    'en-US': enUS,
};

const props = defineProps<{
    page: any
}>();

const locale = ref(zhCN);
onLocaleChange((newLocale) => {
    locale.value = locales[newLocale];
});

</script>
