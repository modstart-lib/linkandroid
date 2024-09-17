<script setup lang="ts">
const props = defineProps<{
    value: string | undefined
}>()
</script>

<template>
    <div class="pb-html-viewer" v-html="props.value"></div>
</template>

<style lang="less" scoped>
.pb-html-viewer {

}
</style>
