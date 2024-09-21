<script setup lang="ts">
import android from './AppIconAssets/android.svg'
import {computed} from "vue";

const images = {
    android,
}

const props = withDefaults(defineProps<{
    name: string,
    size?: string
}>(), {
    isFolder: false,
    size: '100%'
})

const extSrc = computed(() => {
    return images['android']
})

const extSrcUrl = computed(() => {
    return `url("${extSrc.value}")`
})

</script>

<template>
    <div class="pb-app-icon"
         :style="{width: props.size, height: props.size, backgroundImage:extSrcUrl}">
    </div>
</template>

<style scoped>
.pb-app-icon {
    display: inline-block;
    background-size: contain;
    background-position: center;
    background-repeat: no-repeat;

    &:after {
        content: '';
        display: block;
        padding-top: 100%;
    }
}
</style>
