<script setup lang="ts">
import {onMounted, onUnmounted, ref} from 'vue'
import {t} from '../../lang'
import {testActionSet, testActionUnset} from '../../utils/test'

const visible = ref(false)
const running = ref(false)

type DiagnoseStatus = 'waiting' | 'running' | 'success' | 'fail'

interface DiagnoseItem {
    key: string
    title: string
    status: DiagnoseStatus
    output: string
    hint: string
}

const itemKeys = ['platform', 'adbFile', 'adbVersion', 'scrcpyFile', 'port5037', 'devices'] as const

const items = ref<DiagnoseItem[]>([])

const initItems = () => {
    items.value = itemKeys.map((key) => ({
        key,
        title: t(`device.diagnoseItem.${key}`),
        status: 'waiting',
        output: '',
        hint: '',
    }))
}

const findItem = (key: string) => items.value.find((i) => i.key === key)

const setItem = (key: string, status: DiagnoseStatus, output: string, hint: string = '') => {
    const item = findItem(key)
    if (item) {
        item.status = status
        item.output = output
        item.hint = hint
    }
}

const outputEncoding = () => (window.$mapi.app.platformName() === 'win' ? 'cp936' : 'utf8')

const runAdbVersion = async (adbPath: string): Promise<{ok: boolean; output: string; hint: string}> => {
    try {
        const controller = await window.$mapi.app.spawnShell([adbPath, 'version'], {
            env: {},
            shell: false,
            outputEncoding: outputEncoding(),
        })
        const output = (await controller.result()).trim()
        if (/Android Debug Bridge/.test(output)) {
            return {ok: true, output, hint: ''}
        }
        return {ok: false, output, hint: 'adb version 未输出正常版本信息，可执行文件可能不完整或已被安全软件破坏。'}
    } catch (e: any) {
        const message = String(e?.message ?? e ?? 'adb version 执行失败')
        const codeMatch = message.match(/code\s*(\d+)/i)
        const exitCode = codeMatch?.[1] ?? ''
        let hint = ''
        if (exitCode === '3221226505' || /3221226505|0xC0000409/i.test(message)) {
            hint =
                '退出码 3221226505 (0xC0000409)：adb.exe 启动即被终止，通常是杀毒/安全软件拦截，或 adb.exe 文件损坏/不完整。建议将软件安装目录加入安全软件白名单后重试。'
        } else {
            hint = `adb 运行失败（退出码 ${exitCode || '未知'}）：${message}`
        }
        return {ok: false, output: message, hint}
    }
}

const runDiagnose = async () => {
    if (running.value) return
    running.value = true
    initItems()

    // 当前运行平台
    const platform = window.$mapi.app.platformName()
    setItem('platform', 'success', platform)

    // 1. adb 可执行文件
    let adbPath = ''
    try {
        adbPath = await window.$mapi.adb.getBinPath()
    } catch (e: any) {
        setItem('adbFile', 'fail', String(e?.message ?? e), '无法获取 adb 路径')
    }
    if (adbPath) {
        const exists = await window.$mapi.file.exists(adbPath)
        if (!exists) {
            setItem('adbFile', 'fail', adbPath, 'adb 可执行文件不存在，安装可能不完整，请重新安装。')
        } else {
            const stat = await window.$mapi.file.stat(adbPath)
            if (!stat || stat.size <= 0) {
                setItem(
                    'adbFile',
                    'fail',
                    `${adbPath}\n文件大小: ${stat?.size ?? '未知'}`,
                    'adb 文件为空或大小为 0，安装可能不完整。',
                )
            } else {
                setItem('adbFile', 'success', `${adbPath}\n文件大小: ${stat.size} 字节`)
            }
        }
    }

    // 2. adb 运行测试
    setItem('adbVersion', 'running', 'adb version ...')
    const adbResult = adbPath ? await runAdbVersion(adbPath) : {ok: false, output: '未获取到 adb 路径', hint: ''}
    setItem('adbVersion', adbResult.ok ? 'success' : 'fail', adbResult.output, adbResult.hint)

    // 3. scrcpy 可执行文件
    try {
        const scrcpyPath = await window.$mapi.scrcpy.getBinPath()
        const exists = await window.$mapi.file.exists(scrcpyPath)
        if (!exists) {
            setItem('scrcpyFile', 'fail', scrcpyPath, 'scrcpy 可执行文件不存在，安装可能不完整，请重新安装。')
        } else {
            const stat = await window.$mapi.file.stat(scrcpyPath)
            setItem('scrcpyFile', 'success', `${scrcpyPath}\n文件大小: ${stat?.size ?? '未知'} 字节`)
        }
    } catch (e: any) {
        setItem('scrcpyFile', 'fail', String(e?.message ?? e), '无法获取 scrcpy 路径')
    }

    // 4. 5037 端口占用
    setItem('port5037', 'running', '')
    const portOutput = await window.$mapi.app
        .shell(platform === 'win' ? 'netstat -ano | findstr 5037' : 'lsof -nP -iTCP:5037 -sTCP:LISTEN', {
            outputEncoding: outputEncoding(),
        })
        .then(
            (r) => `${r.stdout}\n${r.stderr}`.trim(),
            (e: any) => `${e?.stdout ?? ''}\n${e?.stderr ?? ''}`.trim() || String(e?.message ?? e),
        )
    if (platform === 'win') {
        if (/LISTENING|ESTABLISHED/.test(portOutput)) {
            setItem(
                'port5037',
                'fail',
                portOutput,
                '端口 5037 已被进程监听/占用，若占用者不是本软件内置 adb，请排查其他 adb 版本、模拟器或手机管理工具。',
            )
        } else {
            setItem(
                'port5037',
                'fail',
                portOutput || '端口 5037 无监听',
                '没有发现 adb server 监听 5037 端口，说明 adb server 未启动或启动失败（请关注上方 adb 运行测试结果）。',
            )
        }
    } else {
        if (portOutput) {
            setItem('port5037', 'success', portOutput)
        } else {
            setItem(
                'port5037',
                'fail',
                portOutput || '端口 5037 无监听',
                '没有发现 adb server 监听 5037 端口，adb server 未启动或启动失败。',
            )
        }
    }

    // 5. adb devices
    try {
        const devices = (await window.$mapi.adb.devices()) || []
        const output = devices.length ? devices.map((d: any) => `${d.id}\t${d.type}`).join('\n') : '无设备'
        const onlineCount = devices.filter((d: any) => d.type === 'device').length
        setItem('devices', 'success', `${output}\n\n在线设备: ${onlineCount} / ${devices.length}`)
    } catch (e: any) {
        setItem('devices', 'fail', String(e?.message ?? e), '无法获取设备列表')
    }

    running.value = false
}

const show = () => {
    visible.value = true
    runDiagnose().then()
}

defineExpose({
    show,
})

onMounted(() => {
    testActionSet('device.mirrorDiagnose.show', () => show())
    testActionSet('device.mirrorDiagnose.retry', () => runDiagnose())
})

onUnmounted(() => {
    testActionUnset('device.mirrorDiagnose.show')
    testActionUnset('device.mirrorDiagnose.retry')
})
</script>

<template>
    <a-modal
        v-model:visible="visible"
        width="min(680px, 95vw)"
        :footer="false"
        title-align="start"
        :mask-closable="false"
    >
        <template #title>
            <div class="font-bold flex items-center gap-2">
                <i-lucide-stethoscope class="w-4 h-4" aria-hidden="true" />
                {{ $t('device.diagnoseTitle') }}
            </div>
        </template>
        <div style="height: calc(100vh - 15rem)">
            <div class="p-4 flex flex-col gap-3 h-full">
                <div class="text-xs text-gray-500">{{ $t('device.diagnoseHint') }}</div>
                <div class="flex-1 overflow-auto rounded-lg border border-solid border-gray-200 dark:border-gray-700">
                    <div
                        v-for="item in items"
                        :key="item.key"
                        class="flex gap-3 p-3 border-b border-solid border-gray-100 dark:border-gray-800 last:border-b-0"
                    >
                        <div class="pt-1 flex-shrink-0">
                            <span
                                class="inline-block w-2.5 h-2.5 rounded-full"
                                :class="{
                                    'bg-gray-300 dark:bg-gray-600': item.status === 'waiting',
                                    'bg-blue-500 animate-pulse': item.status === 'running',
                                    'bg-green-500': item.status === 'success',
                                    'bg-red-500': item.status === 'fail',
                                }"
                            />
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="text-sm font-medium flex items-center gap-2">
                                {{ item.title }}
                                <span
                                    v-if="item.status !== 'waiting'"
                                    class="text-xs px-1.5 py-0.5 rounded"
                                    :class="{
                                        'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300':
                                            item.status === 'running',
                                        'bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-300':
                                            item.status === 'success',
                                        'bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-300':
                                            item.status === 'fail',
                                    }"
                                >
                                    {{
                                        item.status === 'running'
                                            ? $t('device.diagnoseStatus.running')
                                            : item.status === 'success'
                                              ? $t('device.diagnoseStatus.success')
                                              : $t('device.diagnoseStatus.fail')
                                    }}
                                </span>
                            </div>
                            <pre class="text-xs text-gray-500 dark:text-gray-400 whitespace-pre-wrap break-all mt-1">{{
                                item.output || $t('device.diagnoseEmpty')
                            }}</pre>
                            <div
                                v-if="item.hint"
                                class="text-xs text-orange-600 dark:text-orange-400 mt-1 rounded bg-orange-50 dark:bg-orange-900/20 px-2 py-1"
                            >
                                {{ item.hint }}
                            </div>
                        </div>
                    </div>
                </div>
                <div class="flex justify-end">
                    <a-button :loading="running" @click="runDiagnose()">
                        <template #icon>
                            <i-lucide-refresh-cw class="w-4 h-4" aria-hidden="true" />
                        </template>
                        {{ $t('device.diagnoseRetry') }}
                    </a-button>
                </div>
            </div>
        </div>
    </a-modal>
</template>
