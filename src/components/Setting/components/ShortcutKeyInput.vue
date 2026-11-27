<script setup lang="ts">
import {ref} from 'vue'
import {keysFromEvent} from '../../../../electron/lib/shortcutKeys'

const props = defineProps<{
    modelValue: string
}>()

const emit = defineEmits(['update:modelValue'])

const recording = ref(false)

const doFocus = () => {
    recording.value = true
}

const doBlur = () => {
    recording.value = false
}

const onKeydown = (event: KeyboardEvent) => {
    event.preventDefault()
    event.stopPropagation()
    if (event.key === 'Escape') {
        recording.value = false
        return
    }
    const keys = keysFromEvent(event)
    if (keys) {
        emit('update:modelValue', keys)
        recording.value = false
    }
}
</script>

<template>
    <a-input
        :model-value="props.modelValue"
        readonly
        :placeholder="recording ? $t('setting.shortcut.recordingPlaceholder') : $t('setting.shortcut.keyPlaceholder')"
        @focus="doFocus"
        @blur="doBlur"
        @keydown="onKeydown"
    />
</template>
