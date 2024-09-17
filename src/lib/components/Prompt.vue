<script setup lang="ts">
import {ref, watch} from "vue";
import {Input as AInput} from "@arco-design/web-vue";

const props = defineProps<{
    value: string,
    onChange: (value: string) => void,
}>()

const value = ref(props.value)
watch(() => value.value, (newVal) => {
    props.onChange(newVal)
})
</script>

<template>
    <div>
        <a-input v-model="value"/>
    </div>
</template>

