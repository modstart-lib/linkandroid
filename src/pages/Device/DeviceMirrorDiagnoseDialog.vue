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

interface PortListener {
    pid: string
    name: string
    path: string
}

const normalizePath = (value: string) => (value || '').trim().replace(/\\/g, '/').toLowerCase()

const isSamePath = (a: string, b: string) => {
    const x = normalizePath(a)
    const y = normalizePath(b)
    if (!x || !y) return false
    return x === y || x.endsWith(`/${y}`) || y.endsWith(`/${x}`)
}

const runShellText = async (command: string): Promise<string> => {
    return await window.$mapi.app.shell(command, {outputEncoding: outputEncoding()}).then(
        (r) => `${r.stdout}\n${r.stderr}`.trim(),
        (e: any) => `${e?.stdout ?? ''}\n${e?.stderr ?? ''}`.trim() || String(e?.message ?? e),
    )
}

const runSpawnText = async (command: string[]): Promise<string> => {
    try {
        const controller = await window.$mapi.app.spawnShell(command, {
            env: {},
            shell: false,
            outputEncoding: outputEncoding(),
        })
        return (await controller.result()).trim()
    } catch {
        return ''
    }
}

// Locate the process listening on TCP 5037 and resolve its executable path
const findPortListener = async (platform: string): Promise<{listener: PortListener | null; raw: string}> => {
    if (platform === 'win') {
        const raw = await runShellText('netstat -ano | findstr :5037')
        let pid = ''
        for (const line of raw.split('\n')) {
            const cols = line.trim().split(/\s+/)
            if (
                cols.length >= 5 &&
                cols[0].toUpperCase() === 'TCP' &&
                /:5037$/.test(cols[1]) &&
                cols[3].toUpperCase() === 'LISTENING'
            ) {
                pid = cols[4]
                break
            }
        }
        if (!pid) return {listener: null, raw}
        const path = (
            await runSpawnText([
                'powershell',
                '-NoProfile',
                '-Command',
                `(Get-Process -Id ${pid} -ErrorAction SilentlyContinue).Path`,
            ])
        )
            .split('\n')[0]
            .trim()
        let name = path ? path.split(/[\\/]/).pop() || '' : ''
        if (!name) {
            const tasklist = await runShellText(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`)
            name = tasklist.match(/"([^"]+\.exe)"/i)?.[1] ?? ''
        }
        return {listener: {pid, name, path}, raw}
    }
    const raw = await runShellText('lsof -nP -iTCP:5037 -sTCP:LISTEN')
    let pid = ''
    let name = ''
    for (const line of raw.split('\n')) {
        const cols = line.trim().split(/\s+/)
        if (
            cols.length >= 2 &&
            cols[0].toUpperCase() !== 'COMMAND' &&
            /^\d+$/.test(cols[1]) &&
            line.includes(':5037') &&
            /LISTEN/.test(line)
        ) {
            pid = cols[1]
            name = cols[0]
            break
        }
    }
    if (!pid) return {listener: null, raw}
    const path = (await runSpawnText(['ps', '-p', pid, '-o', 'comm='])).split('\n')[0].trim()
    return {listener: {pid, name: path ? path.split('/').pop() || name : name, path}, raw}
}

const isOurAdb = (listener: PortListener, adbPath: string) => {
    if (listener.path && isSamePath(listener.path, adbPath)) return true
    if (!listener.path && listener.name) {
        const ourName = adbPath.split(/[\\/]/).pop() || ''
        if (ourName && listener.name.toLowerCase() === ourName.toLowerCase()) return true
    }
    return false
}

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
        return {ok: false, output, hint: t('device.diagnoseAdbVersionAbnormal')}
    } catch (e: any) {
        const message = String(e?.message ?? e ?? t('device.diagnoseAdbVersionFailed'))
        const codeMatch = message.match(/code\s*(\d+)/i)
        const exitCode = codeMatch?.[1] ?? ''
        let hint = ''
        if (exitCode === '3221226505' || /3221226505|0xC0000409/i.test(message)) {
            hint = t('device.diagnoseAdbExitHint')
        } else {
            hint = t('device.diagnoseAdbRunFailed', {code: exitCode || t('device.diagnoseUnknown'), message})
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
    const platformText =
        platform === 'win'
            ? t('device.diagnosePlatform.win')
            : platform === 'osx'
              ? t('device.diagnosePlatform.osx')
              : platform === 'linux'
                ? t('device.diagnosePlatform.linux')
                : String(platform ?? '')
    setItem('platform', 'success', platformText)

    // 1. adb 可执行文件
    let adbPath = ''
    try {
        adbPath = await window.$mapi.adb.getBinPath()
    } catch (e: any) {
        setItem('adbFile', 'fail', String(e?.message ?? e), t('device.diagnoseAdbPathFailed'))
    }
    if (adbPath) {
        const exists = await window.$mapi.file.exists(adbPath)
        if (!exists) {
            setItem('adbFile', 'fail', adbPath, t('device.diagnoseAdbFileMissing'))
        } else {
            const stat = await window.$mapi.file.stat(adbPath)
            if (!stat || stat.size <= 0) {
                setItem(
                    'adbFile',
                    'fail',
                    `${adbPath}\n${t('device.diagnoseFileSize', {size: stat?.size ?? t('device.diagnoseUnknown')})}`,
                    t('device.diagnoseAdbFileEmpty'),
                )
            } else {
                setItem('adbFile', 'success', `${adbPath}\n${t('device.diagnoseFileSize', {size: stat.size})}`)
            }
        }
    }

    // 2. adb 运行测试
    setItem('adbVersion', 'running', 'adb version ...')
    const adbResult = adbPath
        ? await runAdbVersion(adbPath)
        : {ok: false, output: t('device.diagnoseAdbPathEmpty'), hint: ''}
    setItem('adbVersion', adbResult.ok ? 'success' : 'fail', adbResult.output, adbResult.hint)

    // 3. scrcpy 可执行文件
    try {
        const scrcpyPath = await window.$mapi.scrcpy.getBinPath()
        const exists = await window.$mapi.file.exists(scrcpyPath)
        if (!exists) {
            setItem('scrcpyFile', 'fail', scrcpyPath, t('device.diagnoseScrcpyFileMissing'))
        } else {
            const stat = await window.$mapi.file.stat(scrcpyPath)
            setItem(
                'scrcpyFile',
                'success',
                `${scrcpyPath}\n${t('device.diagnoseFileSize', {size: stat?.size ?? t('device.diagnoseUnknown')})}`,
            )
        }
    } catch (e: any) {
        setItem('scrcpyFile', 'fail', String(e?.message ?? e), t('device.diagnoseScrcpyPathFailed'))
    }

    // 4. 5037 端口占用（判断监听进程是否为本软件内置 adb）
    setItem('port5037', 'running', '')
    const {listener: portListener, raw: portOutput} = await findPortListener(platform)
    if (!portListener) {
        const raw = /^Command failed:/i.test(portOutput) ? '' : portOutput
        setItem('port5037', 'fail', raw || t('device.diagnosePortEmpty'), t('device.diagnosePortNotRunning'))
    } else if (isOurAdb(portListener, adbPath)) {
        const owner = `PID ${portListener.pid}${portListener.path ? ` (${portListener.path})` : portListener.name ? ` (${portListener.name})` : ''}`
        setItem('port5037', 'success', `${portOutput}\n\n${t('device.diagnosePortOkOwner', {owner})}`)
    } else {
        const owner = `${portListener.name || t('device.diagnoseUnknownProcess')}（PID ${portListener.pid}）`
        const where = portListener.path ? t('device.diagnosePortOccupiedPath', {path: portListener.path}) : ''
        setItem('port5037', 'fail', portOutput, t('device.diagnosePortOccupied', {owner, where}))
    }

    // 5. adb devices
    try {
        const devices = (await window.$mapi.adb.devices()) || []
        const output = devices.length
            ? devices.map((d: any) => `${d.id}\t${d.type}`).join('\n')
            : t('device.diagnoseDevicesNone')
        const onlineCount = devices.filter((d: any) => d.type === 'device').length
        setItem(
            'devices',
            'success',
            `${output}\n\n${t('device.diagnoseDevicesSummary', {online: onlineCount, total: devices.length})}`,
        )
    } catch (e: any) {
        setItem('devices', 'fail', String(e?.message ?? e), t('device.diagnoseDevicesFailed'))
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
