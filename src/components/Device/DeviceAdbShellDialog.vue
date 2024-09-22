<script setup lang="ts">
import {nextTick, ref, watch} from "vue";
import {DeviceRecord} from "../../types/Device";
import {Terminal} from '@xterm/xterm';
import {FitAddon} from '@xterm/addon-fit';
import 'xterm/css/xterm.css'
import {t} from "../../lang";

const visible = ref(false)
const loading = ref(false)
const device = ref<DeviceRecord | null>(null)
const terminal = ref<Element | null>(null)

let term = null as any
let shellController = null as any
watch(() => visible.value, async (v) => {
    if (v) {
        term = new Terminal({
            fontSize: 14,
            cursorBlink: true,
            cursorStyle: 'underline',
            cols: 80,
            rows: 10,
            // logLevel: 'trace',
            convertEol: true,
        })
        term.onData((data) => {
            shellController.send(data);
        })
        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        term.open(terminal.value as HTMLElement)
        term.clear()
        term.writeln(t('进入设备 {name} 的命令行', {name: device.value?.name}))
        term.writeln('==========================================')
        nextTick(() => {
            fitAddon.fit()
            term.focus()
        }, 0)
        const command = [
            '-s', device.value?.id as string, 'shell', '-tt',
        ].join(' ')
        shellController = await window.$mapi.adb.adbSpawnShell(command, {
            stdout: (data) => {
                // console.log('stdout', JSON.stringify(data))
                term.write(data)
            },
            stderr: (data) => {
                // console.log('stdout', JSON.stringify(data))
                term.write(data)
            },
            success: (data) => {
                // console.log('success', data)
                nextTick(() => {
                    visible.value = false
                })
            },
            error: (data, code) => {
                // console.log('error', code, data)
            },
        })
    } else {
        term && term.dispose()
        shellController?.stop()
    }
})
const show = (d: DeviceRecord) => {
    device.value = d
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
            {{ $t('设备 {name} 命令行', {name: device?.name}) }}
        </template>
        <div style="margin:-0.8rem;border-radius:0.5rem;overflow:hidden;background:#000;">
            <div class="h-full p-2 overflow-hidden">
                <div ref="terminal" style="height:60vh;"></div>
            </div>
        </div>
    </a-modal>
</template>

