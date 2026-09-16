<script setup lang="ts">
import android from './App/Icon/android.svg'
import {computed, ref, watch} from 'vue'

const props = withDefaults(
    defineProps<{
        name: string
        size?: string
    }>(),
    {
        size: '100%',
    },
)

const failed = ref(false)

// 应用图标统一由 iconx 服务按包名生成，失败时回退到内置图标
const iconUrl = computed(() => (props.name ? `https://iconx.tecmz.com/icon/apk/${props.name}.svg` : ''))

const src = computed(() => {
    if (failed.value || !iconUrl.value) {
        return android
    }
    return iconUrl.value
})

watch(
    () => props.name,
    () => {
        failed.value = false
    },
)
</script>

<template>
    <img
        class="pb-app-icon"
        :src="src"
        :style="{width: props.size, height: props.size}"
        loading="lazy"
        alt=""
        @error="failed = true"
    />
</template>

<style scoped>
.pb-app-icon {
    display: inline-block;
    object-fit: contain;
}
</style>
