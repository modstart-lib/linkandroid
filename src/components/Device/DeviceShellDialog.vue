<script setup lang="ts">
import {ref, shallowRef} from "vue";
import VueCommand, {createQuery} from "vue-command";
import "vue-command/dist/vue-command.css";
import {useAdbCommand} from "./Shell/adb";
import {useBasicCommand} from "./Shell/basic";
import {useScrcpyCommand} from "./Shell/scrcpy";

const visible = ref(false)
const loading = ref(false)
const history = shallowRef([createQuery()])
const vueCommand = ref(null)
const commands = ref({})

const {clearCommand, helpCommand} = useBasicCommand({loading, vueCommand, history, commands})
const {adbCommand} = useAdbCommand({loading, vueCommand, history})
const {scrcpyCommand} = useScrcpyCommand({loading, vueCommand, history})

commands.value['adb'] = adbCommand
commands.value['scrcpy'] = scrcpyCommand
commands.value['clear'] = clearCommand
commands.value['help'] = helpCommand
commands.value['exit'] = () => {
    visible.value = false
    return createQuery()
}

const show = () => {
    visible.value = true
}
defineExpose({
    show
})
</script>

<template>
    <a-modal v-model:visible="visible"
             width="50rem"
             :footer="false"
             title-align="start">
        <template #title>
            {{ $t('命令行工具') }}
        </template>
        <div style="height:60vh;margin:-0.8rem;border-radius:0.5rem;overflow:hidden;">
            <VueCommand ref="vueCommand"
                        style="height:100%;"
                        :commands="commands"
                        v-model:history="history"
                        hide-bar
                        show-help
                        :help-text="$t('输入 help 查看帮助')"
                        :help-timeout="3000"
            />
        </div>
    </a-modal>
</template>
