<script setup lang="ts">
import {getCurrentInstance, onBeforeMount, onMounted, ref} from 'vue'
import {Dialog} from './../lib/dialog'
import {t} from '../lang'
import {useDragWindow} from '../components/common/dragWindow'

const app = getCurrentInstance()
const isOsx = ref(false)

const {onDragWindowMouseDown} = useDragWindow({
    name: null,
})

const doQuit = () => {
    Dialog.confirm(t('common.confirmQuit')).then(() => {
        window.$mapi.app.quit()
    })
}

onBeforeMount(async () => {
    if (window.$mapi?.app?.isPlatform) {
        isOsx.value = window.$mapi.app.isPlatform('osx')
    } else {
        isOsx.value = navigator.platform.toUpperCase().indexOf('MAC') >= 0
    }
})

onMounted(() => {
    // document.body.setAttribute('arco-theme', 'dark')
})
</script>
<template>
    <div class="window-container">
        <div
            class="window-header flex h-10 items-center border-b border-solid border-gray-200 dark:border-gray-800"
            :class="{osx: isOsx}"
        >
            <div class="window-header-title no-drag flex-grow flex items-center" @mousedown="onDragWindowMouseDown">
                <div class="p-2 flex-grow">&nbsp;</div>
            </div>
            <div v-if="!isOsx" class="p-1 leading-4">
                <div class="inline-block w-6 h-6 leading-6 cursor-pointer hover:text-red-500" @click="doQuit">
                    <icon-close class="text-sm" />
                </div>
            </div>
        </div>
        <div class="window-body">
            <router-view></router-view>
        </div>
    </div>
</template>
