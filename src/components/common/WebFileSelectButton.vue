<script setup lang="ts">
const props = defineProps({
    accept: {
        type: String,
        default: "",
    },
});
const emit = defineEmits({
    selectFile: (file: File) => true,
});

const onWebSelectFile = async (fileList, fileItem) => {
    const file = fileItem.file;
    emit("selectFile", file);
    fileList.value = [];
};
</script>

<template>
    <a-upload :auto-upload="false" :show-file-list="false" :accept="accept" @change="onWebSelectFile">
        <template #upload-button>
            <slot></slot>
        </template>
    </a-upload>
</template>

<style scoped></style>
