<script setup lang="ts">
import {nextTick, ref} from "vue";
import {DeviceRecord} from "../types/Device";
import {Terminal} from "xterm";
// import * as fit from 'xterm/lib/addons/fit/fit'
// import 'xterm/lib/addons/fullscreen/fullscreen.css'
import 'xterm/css/xterm.css'
import {t} from "../lang";

const visible = ref(false)
const loading = ref(false)
const device = ref<DeviceRecord | null>(null)
const terminal = ref<Element | null>(null)

const term = new Terminal({
    fontSize: 14,
    screenKeys: true,
    useStyle: true
});
term.onData((data) => {
    term.write(data);
})
let shellController = null as any
const show = (d: DeviceRecord) => {
    device.value = d
    visible.value = true
    nextTick(async () => {
        term.open(terminal.value as HTMLElement)
        term.focus()
        term.clear()
        term.writeln(t('进入设备 {name} 的命令行', {name: d.name}))
        term.writeln('==========================================')
        const command = [
            '-s', device.value?.id as string, 'shell'
        ].join(' ')
        shellController = await window.$mapi.adb.adbSpawnShell(command, {
            stdout: (data) => {
                console.log('stdout', data)
            },
            stderr: (data) => {
                console.log('stdout', data)
            },
            success: (data) => {
                console.log('success', data)
            },
            error: (data) => {
                console.log('error', data)
            },
        })
        setTimeout(() => {
            shellController.stop()
        }, 3000)
        console.log('shellController', shellController)
        console.log('shellController.result', await shellController.result())
    })
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
            {{ $t('设备 {name} 命令行', {name: device?.name}) }}
        </template>
        <div style="margin:-0.8rem;border-radius:0.5rem;overflow:hidden;background:#000;">
            <div class="h-full p-2 overflow-hidden" style="height:60vh;">
                <div ref="terminal"></div>
            </div>
        </div>
    </a-modal>
</template>

