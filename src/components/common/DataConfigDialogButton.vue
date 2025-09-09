<script setup lang="ts">
import {ref} from "vue";

const props = defineProps<{
    title: string;
    name: string;
    defaultValue: string;
    placeholder?: string;
}>();
const visible = ref(false);
const content = ref("");
const doShow = async () => {
    visible.value = true;
    content.value = (await $mapi.storage.get("data", props.name, props.defaultValue)) as string;
};
const doSave = () => {
    visible.value = false;
    $mapi.storage.set("data", props.name, content.value);
};
const doRestore = () => {
    content.value = props.defaultValue;
    $mapi.storage.set("data", props.name, content.value);
};
</script>

<template>
    <a-button @click="doShow()">
        <template #icon>
            <icon-settings />
        </template>
        {{ title }}
    </a-button>
    <a-modal v-model:visible="visible" width="800px" title-align="start">
        <template #title>
            {{ title }}
        </template>
        <template #footer>
            <a-button @click="doRestore">
                {{ $t("恢复默认") }}
            </a-button>
            <a-button type="primary" @click="doSave">
                {{ $t("保存") }}
            </a-button>
        </template>
        <div style="max-height: 60vh">
            <div>
                <a-textarea v-model="content" :placeholder="placeholder" :auto-size="{minRows: 15, maxRows: 15}" />
            </div>
        </div>
    </a-modal>
</template>
