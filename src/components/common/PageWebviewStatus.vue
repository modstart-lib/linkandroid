<script setup lang="ts">
import {ref} from "vue";

type StatusType = 'success' | 'fail' | 'loading'
const status = ref<StatusType>('loading')
const emit = defineEmits([
    'refresh',
])
const setStatus = (s: StatusType) => {
    status.value = s
}
defineExpose({
    setStatus
})
</script>

<template>
    <div v-if="'loading'===status"
         class="absolute inset-0 flex bg-default text-default">
        <div class="m-auto text-center text-gray-400">
            <div>
                <icon-loading class="text-3xl"/>
            </div>
            <div class="text-sm pt-2">
                加载中...
            </div>
        </div>
    </div>
    <div v-else-if="'fail'===status"
         class="absolute inset-0 flex bg-default text-default bg-opacity-50">
        <div class="m-auto text-center text-red-400">
            <div>
                <icon-info-circle class="text-3xl"/>
            </div>
            <div>
                内容加载失败，请检查网络连接
            </div>
            <div class="mt-4">
                <a-button size="mini" @click="emit('refresh')">
                    <template #icon>
                        <icon-refresh class="tw-mr-1"/>
                    </template>
                    刷新
                </a-button>
            </div>
        </div>
    </div>
</template>

<style scoped lang="less">

</style>
