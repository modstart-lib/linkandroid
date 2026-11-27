import {cloneDeep} from 'lodash-es'
import {defineStore} from 'pinia'
import {computed, ComputedRef, ref, toRaw} from 'vue'
import {t} from '../../lang'
import {Dialog} from '../../lib/dialog'
import {mapError} from '../../lib/error'
import {isIPWithPort, parseIPPort} from '../../lib/linkandroid'
import {ShellUtil} from '../../lib/util'

import {
    AppMirror,
    DeviceGroup,
    DeviceRecord,
    DeviceRuntime,
    DeviceSetting,
    EnumDeviceStatus,
    EnumDeviceType,
    ShellController,
} from '../../types/Device'
import store from '../index'
import {useSettingStore} from './setting'

function escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// scrcpy 退出码：0=正常结束，1=启动失败（没连上），2=运行中设备掉线
const SCRCPY_EXIT_DISCONNECTED = 2

// 预览进程（DeviceManage）连续启动失败的最大重试次数；超过后等下一次设备连接再试
const DEVICE_MANAGE_MAX_RETRY = 5
// 预览进程稳定运行多久后重置失败计数（避免每次 spawn 成功就清零导致 3 秒一轮的重试风暴）
const DEVICE_MANAGE_STABLE_MS = 30000
// 同一设备自动投屏的最小间隔，避免设备反复掉线/重连时不停拉起投屏窗口
const AUTO_MIRROR_MIN_INTERVAL = 10000

const getEmptySetting = () => {
    return JSON.parse(
        JSON.stringify({
            autoMirror: '',
            dimWhenMirror: '',
            alwaysTop: '',
            mirrorSound: '',
            previewImage: '',
            videoBitRate: '',
            maxFps: '',
            scrcpyArgs: '',
            panelShow: '',
            powerSaveBlock: '',
            windowBorderless: '',
        }),
    )
}

const deviceRuntime = ref<Map<string, DeviceRuntime>>(new Map())
const setting = useSettingStore()
const previewImageDefault = setting.configGet('Device.previewImage', 'yes')

// WebSocket 客户端管理
let ws: WebSocket | null = null
let wsReconnectTimer: ReturnType<typeof setTimeout> | null = null
let wsReconnectAttempts = 0
const wsMaxReconnectAttempts = 10
const wsReconnectDelay = 3000

const deviceControllers = new Map<string, ShellController>()

// 用户主动停止的 DeviceManage（stop() 强杀进程会以非 0 退出码结束，需要与
// 意外失败区分开，避免触发自动重试）
const deviceManageStopped = new Set<string>()

// DeviceManage 启动串行队列：多台设备同时启动会并发抢占 adb reverse 端口导致
// 大部分启动失败，所以按固定间隔错峰串行启动
let deviceManageStartChain: Promise<void> = Promise.resolve()

// 连接自动投屏的并发保护：refresh 可能被 adb watch 连续触发，避免同一设备重复拉起投屏窗口
const autoMirrorInFlight = new Set<string>()
// 自动投屏最近一次尝试时间（掉线重连时限频，避免反复弹窗、反复拉起窗口）
const autoMirrorLastAttempt = new Map<string, number>()
// 投屏进程正在启动：期间不能再启动同设备的预览进程，否则两个 scrcpy 抢手机编码器
const mirrorStarting = new Set<string>()
// 预览进程本次启动的时间，用于判断是否稳定运行后重置失败计数
const deviceManageStartedAt = new Map<string, number>()
// refresh 单飞：adb watch / WebSocket 会并发触发 refresh，多次并发会导致状态反复翻转
let refreshChain: Promise<void> | null = null

const shouldStartDeviceManage = (record: DeviceRecord) => {
    return !window.__TEST_MODE__ && !isSeedConnectedDevice(record)
}

const createDeviceStatus = (record: DeviceRecord): ComputedRef<EnumDeviceStatus> => {
    const id = record.id
    return computed(() => {
        return deviceRuntime.value?.get(id)?.status || EnumDeviceStatus.WAIT_CONNECTING
    })
}

const getDeviceRuntime = (record: DeviceRecord): ComputedRef<DeviceRuntime> => {
    const id = record.id
    return computed(() => {
        const value = deviceRuntime.value?.get(id)
        if (value) {
            return value
        }
        deviceRuntime.value?.set(id, {
            status: EnumDeviceStatus.WAIT_CONNECTING,
            mirrorController: null,
            cameraController: null,
            appMirrors: [],
            previewImage: record.setting?.previewImage || previewImageDefault,
        } as DeviceRuntime)
        return deviceRuntime.value?.get(id) as DeviceRuntime
    })
}

const updateDeviceRuntime = (record: DeviceRecord) => {
    const id = record.id
    const runtime = deviceRuntime.value?.get(id)
    if (!runtime) {
        return
    }
    deviceRuntime.value?.set(id, {
        ...runtime,
        previewImage: record.setting?.previewImage || previewImageDefault,
    })
}

const deleteDeviceRuntime = (record: DeviceRecord) => {
    deviceRuntime.value?.delete(record.id)
}

const isSeedConnectedDevice = (record: DeviceRecord) => {
    return record.raw?.seedConnected === true
}

// 连接 WebSocket
const connectWebSocket = async () => {
    try {
        const wsAddress = await $mapi.serve.getAddress()

        if (ws && ws.readyState === WebSocket.OPEN) {
            return
        }

        // 添加查询参数标识为 Render 客户端
        const wsUrl = `${wsAddress}/server?type=Render`
        ws = new WebSocket(wsUrl)

        ws.onopen = () => {
            console.log('WebSocket connected to server as Render client')
            wsReconnectAttempts = 0
        }

        ws.onmessage = (event) => {
            // console.log('WebSocket message received:', event.data);
            try {
                const data = JSON.parse(event.data)

                if (data.type === 'DeviceConnect') {
                    console.log('Device connected:', data.deviceId)
                    deviceStore().refresh()
                    return
                }

                if (data.type === 'DeviceDisconnect') {
                    console.log('Device disconnected:', data.deviceId)
                    deviceStore().refresh()
                    return
                }

                if (data.type === 'DevicePreview') {
                    const {deviceId, data: previewData} = data
                    const device = deviceStore().records.find((r) => r.id === deviceId)
                    if (device && previewData) {
                        deviceStore().edit(
                            device,
                            {
                                screenshot: previewData,
                            },
                            false,
                        )
                    }
                    return
                }

                if (data.type === 'DevicePanelButtonClick') {
                    handlePanelButtonClick(data.deviceId, data.data.id)
                    return
                }

                if (data.type === 'DeviceStatus') {
                    return
                }

                console.log('WebSocket message:', data)
            } catch (error) {
                console.error('WebSocket message parse error:', error)
            }
        }

        ws.onclose = () => {
            console.log('WebSocket disconnected, will retry...')
            ws = null

            // 自动重连
            if (wsReconnectAttempts < wsMaxReconnectAttempts) {
                wsReconnectAttempts++
                const delay = Math.min(wsReconnectDelay * wsReconnectAttempts, 30000) // 最长30秒
                console.log(
                    `WebSocket reconnecting in ${delay}ms (attempt ${wsReconnectAttempts}/${wsMaxReconnectAttempts})`,
                )
                wsReconnectTimer = setTimeout(() => {
                    connectWebSocket()
                }, delay)
            } else {
                console.error('WebSocket max reconnection attempts reached')
            }
        }

        ws.onerror = (error) => {
            console.error('WebSocket error:', error)
        }
    } catch (error) {
        console.error('Failed to connect WebSocket:', error)
    }
}

// 断开 WebSocket
const disconnectWebSocket = () => {
    if (wsReconnectTimer) {
        clearTimeout(wsReconnectTimer)
        wsReconnectTimer = null
    }
    if (ws) {
        ws.close()
        ws = null
    }
}

const handlePanelButtonClick = async (deviceId: string, buttonId: string) => {
    console.log(`Handling panel button click: device=${deviceId}, button=${buttonId}`)

    let args: string[] = []

    switch (buttonId) {
        case 'home':
            args = ['shell', 'input', 'keyevent', 'KEYCODE_HOME']
            await $mapi.adb.spawnShell(args, {}, deviceId)
            break
        case 'back':
            args = ['shell', 'input', 'keyevent', 'KEYCODE_BACK']
            await $mapi.adb.spawnShell(args, {}, deviceId)
            break
        case 'recent':
            args = ['shell', 'input', 'keyevent', 'KEYCODE_APP_SWITCH']
            await $mapi.adb.spawnShell(args, {}, deviceId)
            break
        case 'volume_up':
            args = ['shell', 'input', 'keyevent', 'KEYCODE_VOLUME_UP']
            await $mapi.adb.spawnShell(args, {}, deviceId)
            break
        case 'volume_down':
            args = ['shell', 'input', 'keyevent', 'KEYCODE_VOLUME_DOWN']
            await $mapi.adb.spawnShell(args, {}, deviceId)
            break
        case 'screenshot':
            args = ['shell', 'input', 'keyevent', 'KEYCODE_SYSRQ']
            await $mapi.adb.spawnShell(args, {}, deviceId)
            break
        case 'close':
            await stopDeviceManage(deviceId)
            break
        default:
            console.log(`Unknown button: ${buttonId}`)
            break
    }
}

// startDeviceManage 串行排队执行：多台设备同时启动会并发抢占 adb reverse 端口，
// 导致大部分 DeviceManage 启动失败（scrcpy 报 "adb reverse returned with value 1"）。
// 通过链式队列 + 固定间隔错峰启动，并在失败后自动重试。
const startDeviceManage = async (deviceId: string) => {
    const task = deviceManageStartChain
        .catch(() => {})
        .then(() => new Promise<void>((resolve) => setTimeout(resolve, 400)))
        .then(async () => {
            await doStartDeviceManage(deviceId)
        })
    deviceManageStartChain = task
    await task
}

// DeviceManage 启动失败后自动重试（设备仍保持连接且未被主动停止时）。
// 采用指数退避：3s → 6s → 12s → ... 上限 60s；连续失败达到上限后停止，
// 等设备重新连接或投屏结束再恢复，避免每 3 秒 push 一次 scrcpy-server 的重试风暴。
const deviceManageRetryCount = new Map<string, number>()
// 取出并清除预览进程的启动时间，返回本次存活时长（毫秒）
const takeDeviceManageUptime = (deviceId: string): number => {
    const startedAt = deviceManageStartedAt.get(deviceId) || 0
    deviceManageStartedAt.delete(deviceId)
    return startedAt ? Date.now() - startedAt : 0
}
const hasActiveMirror = (deviceId: string) => {
    if (mirrorStarting.has(deviceId)) {
        return true
    }
    const runtime = deviceRuntime.value?.get(deviceId)
    return !!runtime && (!!runtime.mirrorController || (runtime.appMirrors?.length || 0) > 0)
}
// uptime：本次进程存活时长；稳定运行过一段时间才重置失败计数
const scheduleDeviceManageRetry = (deviceId: string, uptime: number = 0) => {
    // 投屏期间不需要预览进程（投屏进程自己发预览），也不再重试，避免两个编码器互抢
    if (hasActiveMirror(deviceId)) {
        return
    }
    if (uptime >= DEVICE_MANAGE_STABLE_MS) {
        deviceManageRetryCount.delete(deviceId)
    }
    const count = deviceManageRetryCount.get(deviceId) || 0
    if (count >= DEVICE_MANAGE_MAX_RETRY) {
        window.$mapi.log.error('DeviceManage retry limit reached', {deviceId, count})
        return
    }
    const delay = Math.min(3000 * Math.pow(2, count), 60000)
    deviceManageRetryCount.set(deviceId, count + 1)
    setTimeout(() => {
        if (!deviceManageStopped.has(deviceId)) {
            const device = deviceStore().records.find((r) => r.id === deviceId)
            if (device && device.status === EnumDeviceStatus.CONNECTED && !hasActiveMirror(deviceId)) {
                startDeviceManage(deviceId)
            }
        }
    }, delay)
}

// 投屏结束后恢复预览进程；同一设备同时只保留一个 scrcpy 进程
const restoreDeviceManage = (deviceId: string) => {
    const tryRestore = (attempt: number) => {
        const device = deviceStore().records.find((r) => r.id === deviceId)
        if (!device || device.status !== EnumDeviceStatus.CONNECTED) {
            return
        }
        if (deviceControllers.has(deviceId)) {
            return
        }
        if (hasActiveMirror(deviceId)) {
            // 可能正处于新一次投屏的启动窗口，稍后再确认
            if (attempt < 3) {
                setTimeout(() => tryRestore(attempt + 1), 800)
            }
            return
        }
        startDeviceManage(deviceId)
    }
    setTimeout(() => tryRestore(0), 1000)
}

// 启动 debug_manage（管理模式：预览+无视频音频播放）
const doStartDeviceManage = async (deviceId: string) => {
    try {
        // 投屏进程正在运行或正在启动时不再启动预览进程：
        // 同一手机同时跑两个 scrcpy 会抢占硬件编码器（实测报 MediaCodec Error 0xfffffff4），
        // 并把投屏连接一起拖断
        if (hasActiveMirror(deviceId)) {
            return
        }

        // 启动流程开始即视为需要运行，清除可能遗留的停止标记
        // （避免上次 stopDeviceManage 流程遗留的标记导致本次无法启动）
        deviceManageStopped.delete(deviceId)

        // 如果已经在运行,先停止
        if (deviceControllers.has(deviceId)) {
            await stopDeviceManage(deviceId)
            // stopDeviceManage 会打上 stopped 标记（用于避免旧进程退出触发重试），
            // 替换完成后必须清除，否则新进程异常退出时会被当成"主动停止"而不重试
            deviceManageStopped.delete(deviceId)
        }

        const wsAddress = await $mapi.serve.getAddress()

        const wsUrl = `${wsAddress}/server?type=DeviceManage&deviceId=${deviceId}`
        const controller = await $mapi.scrcpy.spawnShell(
            [
                // "-V","debug",
                '--serial',
                deviceId,
                '--linkandroid-server',
                wsUrl,
                '--linkandroid-preview-interval',
                '1000',
                '--linkandroid-preview-ratio',
                '30',
                '--no-video-playback',
                '--no-audio-playback',
                '--linkandroid-skip-taskbar',
            ],
            {
                stdout: (data: string) => {
                    window.$mapi.log.info('Render.DeviceManage.stdout', {deviceId, data})
                },
                stderr: (data: string) => {
                    window.$mapi.log.info('Render.DeviceManage.stderr', {deviceId, data})
                },
                success: (process: any) => {
                    // Windows 下 scrcpy 启动失败（adb reverse 冲突/连接失败）以
                    // exitCode=1 退出，App.spawnShell 会把它当作"成功"，这里手动
                    // 识别非 0 退出码并触发自动重试
                    const exitCode = process?.exitCode
                    const uptime = takeDeviceManageUptime(deviceId)
                    window.$mapi.log.info('Render.DeviceManage.success', {deviceId, exitCode, uptime})
                    deviceControllers.delete(deviceId)
                    if (deviceManageStopped.has(deviceId)) {
                        deviceManageStopped.delete(deviceId)
                        return
                    }
                    if (exitCode !== 0 && exitCode !== null && exitCode !== undefined) {
                        window.$mapi.log.error('DeviceManage exited abnormally, will retry', {
                            deviceId,
                            exitCode,
                            uptime,
                        })
                        scheduleDeviceManageRetry(deviceId, uptime)
                    }
                },
                error: (msg: string, exitCode: number) => {
                    const uptime = takeDeviceManageUptime(deviceId)
                    window.$mapi.log.error('Render.DeviceManage.error', {deviceId, msg, exitCode, uptime})
                    deviceControllers.delete(deviceId)
                    if (deviceManageStopped.has(deviceId)) {
                        deviceManageStopped.delete(deviceId)
                        return
                    }
                    scheduleDeviceManageRetry(deviceId, uptime)
                },
            },
        )
        deviceControllers.set(deviceId, controller)
        // 记录本次启动时间：只有稳定运行一段时间后才重置失败计数，
        // 避免「spawn 成功 → 秒退 → 计数清零 → 3 秒后再试」的无限循环
        deviceManageStartedAt.set(deviceId, Date.now())
    } catch (error) {
        window.$mapi.log.error('Failed to start debug_manage:', {deviceId, error})
        if (!deviceManageStopped.has(deviceId)) {
            scheduleDeviceManageRetry(deviceId)
        }
    }
}

const stopDeviceManage = async (deviceId: string) => {
    // 标记为主动停止，避免强杀进程后的非 0 退出码触发自动重试
    deviceManageStopped.add(deviceId)
    // 重置失败重试计数，避免后续重连后沿用旧的退避间隔
    deviceManageRetryCount.delete(deviceId)
    deviceManageStartedAt.delete(deviceId)
    const controller = deviceControllers.get(deviceId)
    if (controller) {
        try {
            controller.stop()
        } catch (error) {
            console.error('Failed to stop debug_manage:', deviceId, error)
        }
        deviceControllers.delete(deviceId)
    }
}

export const deviceStore = defineStore('device', {
    state: () => ({
        records: [] as DeviceRecord[],
        groups: [] as DeviceGroup[],
    }),
    actions: {
        async init() {
            await $mapi.storage.get('device', 'records', []).then((records) => {
                records.forEach((record: DeviceRecord) => {
                    record.status = createDeviceStatus(record)
                    record.runtime = getDeviceRuntime(record)
                    record.screenshot = record.screenshot || null
                    record.setting = record.setting || getEmptySetting()
                })
                this.records = records
            })

            await this.loadGroups()

            // 连接 WebSocket
            await connectWebSocket()

            await this.refresh()
            setTimeout(async () => {
                await this.startWatch()
            }, 2000)
        },
        async startWatch() {
            await $mapi.adb.watch((type, data) => {
                // console.log('watch', type, data)
                this.refresh().then()
            })
        },
        async connectedDevices(): Promise<DeviceRecord[]> {
            const res = await $mapi.adb.devices()
            const data: DeviceRecord[] = []
            for (const d of res || []) {
                data.push({
                    id: d.id,
                    type: isIPWithPort(d.id) ? EnumDeviceType.WIFI : EnumDeviceType.USB,
                    name: d.model ? d.model.split(':')[1] : d.id,
                    raw: d,
                    status: createDeviceStatus(d),
                    runtime: getDeviceRuntime(d),
                    screenshot: d.screenshot || null,
                    setting: getEmptySetting(),
                })
            }
            return data
        },
        // 单飞：adb watch / WebSocket 会并发触发 refresh，并发执行会导致状态反复翻转，
        // 进而重复拉起预览进程与投屏窗口
        async refresh() {
            if (refreshChain) {
                return refreshChain
            }
            refreshChain = this.doRefresh().finally(() => {
                refreshChain = null
            })
            return refreshChain
        },
        async doRefresh() {
            let connectedDevices: DeviceRecord[] = []
            try {
                connectedDevices = await this.connectedDevices()
            } catch (e) {
                if (!this.records.some((record) => isSeedConnectedDevice(record))) {
                    throw e
                }
            }
            let changed = false
            // 将新设备加入到列表中
            for (const device of connectedDevices) {
                let record = this.records.find((record) => record.id === device.id)
                if (!record) {
                    record = {
                        id: device.id,
                        type: device.type,
                        name: device.name,
                        raw: device.raw,
                        status: createDeviceStatus(device),
                        runtime: getDeviceRuntime(device),
                        screenshot: null,
                        setting: getEmptySetting(),
                    }
                    this.records.unshift(record)
                    changed = true
                }
            }
            // 设置已连接的设备状态
            const connectedDeviceIds = [
                ...connectedDevices.map((d) => d.id),
                ...this.records.filter((d) => isSeedConnectedDevice(d)).map((d) => d.id),
            ]
            for (const record of this.records) {
                const runtime = getDeviceRuntime(record)
                if (connectedDeviceIds.includes(record.id)) {
                    if (runtime.value.status !== EnumDeviceStatus.CONNECTED) {
                        runtime.value.status = EnumDeviceStatus.CONNECTED
                        changed = true

                        // 自动启动 debug_manage
                        if (shouldStartDeviceManage(record)) {
                            // 设备重新连接后清除停止标记，允许自动重启
                            deviceManageStopped.delete(record.id)
                            startDeviceManage(record.id)
                        }

                        // 连接自动投屏
                        this.doAutoMirror(record).then()
                    }
                } else {
                    if (runtime.value.status !== EnumDeviceStatus.DISCONNECTED) {
                        runtime.value.status = EnumDeviceStatus.DISCONNECTED
                        changed = true

                        // 停止 debug_manage
                        stopDeviceManage(record.id)
                    }
                }
            }
            // 将已连接的设备排在前面
            this.records.sort((a, b) => {
                if (a.status === EnumDeviceStatus.CONNECTED) {
                    return -1
                }
                if (b.status === EnumDeviceStatus.CONNECTED) {
                    return 1
                }
                // 剩下的按照id排序
                if (a.id && b.id && a.id < b.id) {
                    return -1
                }
                return 0
            })
            // 更新并保存
            if (changed) {
                await this.sync()
            }
        },
        async delete(device: DeviceRecord) {
            const index = this.records.findIndex((record) => record.id === device.id)
            if (index === -1) {
                return
            }
            const runtime = deviceRuntime.value?.get(device.id)
            if (runtime?.cameraController) {
                try {
                    runtime.cameraController.stop()
                } catch (e) {}
                runtime.cameraController = null
            }
            deleteDeviceRuntime(device)
            this.records.splice(index, 1)
            await this.sync()
        },
        async edit(device: DeviceRecord, update: Partial<DeviceRecord>, sync: boolean = true) {
            const record = this.records.find((record) => record.id === device.id)
            if (!record) {
                return
            }
            Object.assign(record, update)
            if (sync) {
                await this.sync()
            }
        },
        async updateSetting(id: string, setting: Partial<DeviceSetting>) {
            const record = this.records.find((record) => record.id === id)
            if (!record) {
                return
            }
            record.setting = Object.assign({}, record.setting, setting)
            updateDeviceRuntime(record)
            await this.sync()
        },
        async updateNetworkPort(device: DeviceRecord, host: string, port: number) {
            if (device.type !== EnumDeviceType.WIFI) {
                return
            }
            const newId = `${host}:${port}`
            if (newId === device.id) {
                return
            }

            const oldId = device.id

            // 1. Disconnect the old address first — removes it from adb devices,
            //    so any concurrent refresh() triggered by adb.watch won't re-add it.
            try {
                if (isIPWithPort(device.id)) {
                    const {ip: oldIp, port: oldPort} = parseIPPort(device.id)
                    await $mapi.adb.disconnect(oldIp, oldPort)
                }
            } catch (e) {}

            // 2. Update the existing record in-place — no duplicate possible
            const record = this.records.find((r) => r.id === oldId)
            if (record) {
                record.id = newId
                record.raw = {...record.raw, id: newId}
                const runtime = deviceRuntime.value.get(oldId)
                if (runtime) {
                    deviceRuntime.value.delete(oldId)
                    deviceRuntime.value.set(newId, runtime)
                }
            }

            // 3. Migrate groups to the new id
            for (const group of this.groups) {
                if (group.deviceIds.includes(oldId)) {
                    group.deviceIds = group.deviceIds.map((id) => (id === oldId ? newId : id))
                }
            }
            await this.syncGroups()

            // 4. Connect to the new address
            await $mapi.adb.connect(host, port)

            // 5. Refresh to pick up the correct status
            await this.refresh()
        },
        async sync() {
            const savedRecords = toRaw(cloneDeep(this.records))
            savedRecords.forEach((record) => {
                record.runtime = undefined
                record.status = undefined
            })
            await $mapi.storage.set('device', 'records', savedRecords)
        },
        async doTop(index: number) {
            const record = this.records[index]
            this.records.splice(index, 1)
            this.records.unshift(record)
            await this.sync()
        },
        // 应用投屏：保存最后一次选择，并在独立虚拟屏中启动该应用（可与主投屏、其他应用同时投屏）
        async doMirrorApp(
            device: DeviceRecord,
            option: {appPackage: string; appName?: string; appDisplaySize?: string; appDisplayDpi?: string},
        ) {
            if (!option.appPackage) {
                throw new Error('AppPackageRequired')
            }
            const runtime = getDeviceRuntime(device)
            if (runtime.value.status !== EnumDeviceStatus.CONNECTED) {
                throw new Error('DeviceNotConnected')
            }
            if (runtime.value.appMirrors.some((m) => m.package === option.appPackage)) {
                throw new Error(t('device.mirrorAppExists'))
            }
            await this.updateSetting(device.id, {
                appPackage: option.appPackage,
                appDisplaySize: option.appDisplaySize || '',
                appDisplayDpi: option.appDisplayDpi || '',
            })
            const entry: AppMirror = {
                package: option.appPackage,
                name: option.appName || option.appPackage,
                controller: null,
            }
            getDeviceRuntime(device).value.appMirrors.push(entry)
            try {
                entry.controller = await this.startMirror(device, {appPackage: option.appPackage})
            } catch (error) {
                const current = getDeviceRuntime(device).value
                current.appMirrors = current.appMirrors.filter((m) => m.package !== option.appPackage)
                throw error
            }
        },
        // 停止单个应用投屏（被投屏应用由投屏退出流程自动结束）
        stopAppMirror(device: DeviceRecord, appPackage: string) {
            const runtime = getDeviceRuntime(device).value
            const entry = runtime.appMirrors.find((m) => m.package === appPackage)
            if (!entry) {
                return
            }
            if (!entry.controller) {
                runtime.appMirrors = runtime.appMirrors.filter((m) => m.package !== appPackage)
                return
            }
            try {
                entry.controller.stop()
            } catch (e) {}
        },
        // 所有投屏都结束时才恢复电脑休眠行为
        releaseMirrorPower(device: DeviceRecord) {
            const runtime = getDeviceRuntime(device).value
            if (!runtime.mirrorController && runtime.appMirrors.length === 0) {
                $mapi.power.stop()
            }
        },
        // 供组件读取设备运行态（含主投屏与应用投屏列表）
        runtimeOf(device: DeviceRecord): DeviceRuntime {
            return getDeviceRuntime(device).value
        },
        async doMirror(device: DeviceRecord) {
            const runtime = getDeviceRuntime(device)
            if (runtime.value.status !== EnumDeviceStatus.CONNECTED) {
                throw new Error('DeviceNotConnected')
            }
            if (runtime.value.mirrorController) {
                try {
                    runtime.value.mirrorController.stop()
                } catch (e) {}
                return
            }
            try {
                runtime.value.mirrorController = await this.startMirror(device, {})
            } catch (error) {
                Dialog.tipError(mapError(error))
            }
        },
        // 连接自动投屏的判定：单设备设置优先，未设置时回落全局默认
        async shouldAutoMirror(device: DeviceRecord): Promise<boolean> {
            return 'yes' === (await this.settingGet(device, 'autoMirror', 'no'))
        },
        // adb 当前是否真的能看到该设备（界面状态可能滞后于 adb，避免给已拔线的设备拉起进程）
        async deviceOnline(deviceId: string): Promise<boolean> {
            try {
                const list = await $mapi.adb.devices()
                return (list || []).some((d) => d.id === deviceId)
            } catch (e) {
                return false
            }
        },
        // 设备连上后按设置自动启动一次主投屏（与手动点击投屏一致）
        async doAutoMirror(device: DeviceRecord) {
            if (window.__TEST_MODE__) {
                return
            }
            const deviceId = device.id
            if (autoMirrorInFlight.has(deviceId)) {
                return
            }
            if (getDeviceRuntime(device).value.mirrorController) {
                return
            }
            // 掉线重连会连续触发 refresh，这里限频，避免反复拉起窗口、反复弹提示
            const lastAttempt = autoMirrorLastAttempt.get(deviceId) || 0
            if (Date.now() - lastAttempt < AUTO_MIRROR_MIN_INTERVAL) {
                return
            }
            // 先占位再 await，否则两次并发调用会同时通过上面的检查
            autoMirrorInFlight.add(deviceId)
            autoMirrorLastAttempt.set(deviceId, Date.now())
            try {
                if (!(await this.shouldAutoMirror(device))) {
                    return
                }
                if (getDeviceRuntime(device).value.mirrorController) {
                    return
                }
                if (!(await this.deviceOnline(deviceId))) {
                    return
                }
                getDeviceRuntime(device).value.mirrorController = await this.startMirror(device, {})
            } catch (error) {
                Dialog.tipError(mapError(error))
            } finally {
                autoMirrorInFlight.delete(deviceId)
            }
        },
        // 启动一个投屏进程（主投屏 / 应用投屏共用），返回进程控制器
        async startMirror(device: DeviceRecord, option?: {appPackage?: string}): Promise<ShellController> {
            const deviceId = device.id
            Dialog.loadingOn(t('device.mirroring'))
            // 同一设备同时跑「预览 + 投屏」两个 scrcpy 会抢占手机硬件编码器
            //（实测 OPPO Android 10 报 MediaCodec Error 0xfffffff4，并把投屏连接一起拖断），
            // 所以投屏期间停掉预览进程，预览改由投屏进程自己发送
            mirrorStarting.add(deviceId)
            if (deviceControllers.has(deviceId)) {
                await stopDeviceManage(deviceId)
                // 等预览进程真正退出、释放手机端编码器后再启动投屏进程
                await new Promise((resolve) => setTimeout(resolve, 300))
            }
            const args = await this.buildMirrorArgs(device, option)
            const powerSaveBlock = await this.settingGet(device, 'powerSaveBlock', 'yes')

            const appPackage = option?.appPackage || ''
            let appLaunched = false
            let active = true
            let stoppedByUser = false
            const session: {controller: ShellController | null} = {controller: null}

            // 虚拟屏投屏时，应用在关闭投屏后需要结束，避免残留在手机侧
            const cleanupMirroredApp = async () => {
                if (!appPackage || !appLaunched) return
                try {
                    await $mapi.adb.shell(device.id, `am force-stop ${appPackage}`)
                } catch (e) {
                    $mapi.log.error('Mirror.appForceStop', e as any)
                }
            }

            // 投屏结束：清理运行态、结束被投屏应用、无其他投屏时恢复电脑休眠与预览进程
            const onMirrorEnd = () => {
                active = false
                cleanupMirroredApp().then()
                // 放到下一轮事件循环：调用方是在 startMirror 返回后才把 controller 写入运行态，
                // 立即清理会被覆盖回「正在投屏」，导致按钮状态与窗口不一致
                setTimeout(() => {
                    const current = getDeviceRuntime(device).value
                    // 运行态读到的是 Vue 响应式代理，必须取原始对象才能按引用比较；
                    // 否则这里永远不相等，关闭投屏后 mirrorController 不被清空，
                    // 卡片一直显示「投屏中」，再次点击只会停止已退出的进程
                    if (appPackage) {
                        current.appMirrors = current.appMirrors.filter((m) => m.package !== appPackage)
                    } else if (toRaw(current.mirrorController) === session.controller) {
                        current.mirrorController = null
                    }
                    this.releaseMirrorPower(device)
                    // 设备仍在线且没有其他投屏时，恢复预览进程
                    restoreDeviceManage(deviceId)
                }, 0)
            }

            let successTimer: ReturnType<typeof setTimeout> | null = null
            let successShown = false
            let unauthorized = false
            const MAX_MIRROR_LOG_LINES = 200
            const logs: string[] = []
            const pushLog = (prefix: string, data: string) => {
                logs.push(prefix + data)
                if (logs.length > MAX_MIRROR_LOG_LINES) {
                    logs.splice(0, logs.length - MAX_MIRROR_LOG_LINES)
                }
            }
            // 启动失败时展示完整日志；设备掉线不算失败，只轻提示
            const showMirrorError = (msg: string) => {
                if (unauthorized) {
                    Dialog.alertError(t('device.mirrorUnauthorized'))
                    return
                }
                const logText = logs.map((l) => l.replace(/^\[(stdout|stderr)\] /, '')).join('\n')
                const detail = logText ? `\n\n<pre>${escapeHtml(logText)}</pre>` : ''
                Dialog.alertError(t('device.mirrorFailed') + ` : <code>${escapeHtml(msg)}</code>${detail}`)
            }
            try {
                const controller = await $mapi.scrcpy.mirror(device.id, {
                    title: device.name as string,
                    args,
                    maxLogLines: MAX_MIRROR_LOG_LINES,
                    // scrcpy 5.0: 0=正常结束 / 1=启动失败 / 2=运行中设备掉线，
                    // 不能沿用 Windows 下把 1 也当成功的默认规则
                    successExitCodes: [0],
                    stdout: (data: string) => {
                        console.log('mirror.stdout', data)
                        $mapi.log.info('Mirror.stdout', data)
                        pushLog('[stdout] ', data)
                        if (/Starting app/i.test(data)) {
                            appLaunched = true
                        }
                        if (!successTimer) {
                            successTimer = setTimeout(() => {
                                if (active) {
                                    successShown = true
                                    Dialog.tipSuccess(t('device.mirrorSuccess'))
                                }
                            }, 2000)
                        }
                    },
                    stderr: (data: string) => {
                        console.log('mirror.stderr', data)
                        $mapi.log.error('Mirror.stderr', data)
                        pushLog('[stderr] ', data)
                        if (/Starting app/i.test(data)) {
                            appLaunched = true
                        }
                        if (/unauthorized/i.test(data)) {
                            unauthorized = true
                        }
                    },
                    success: () => {
                        console.log('mirror.success')
                        $mapi.log.info('Mirror.success', {successShown, stoppedByUser, logs})
                        onMirrorEnd()
                    },
                    error: (msg: string, exitCode: number) => {
                        console.log('mirror.error', {msg, exitCode})
                        $mapi.log.error('Mirror.error', {msg, exitCode, stoppedByUser, logs})
                        onMirrorEnd()
                        // 用户自己关窗口 / 点停止，不提示
                        if (stoppedByUser) {
                            return
                        }
                        if (exitCode === SCRCPY_EXIT_DISCONNECTED) {
                            // 已经投上之后设备掉线：属于设备断开，不是投屏失败
                            Dialog.tipError(t('device.mirrorDisconnected'))
                            return
                        }
                        showMirrorError(msg)
                    },
                })
                // 包一层 stop：用户主动停止（强杀会以非 0 退出码结束）时不弹错误
                session.controller = {
                    ...controller,
                    stop: () => {
                        stoppedByUser = true
                        controller.stop()
                    },
                }
                // 根据用户设置决定是否阻止电脑休眠
                if (powerSaveBlock === 'yes') {
                    $mapi.power.start('prevent-display-sleep')
                }
                return session.controller
            } finally {
                Dialog.loadingOff()
                if (!session.controller) {
                    // 投屏进程没起来（如参数错误/找不到二进制），把被停掉的预览进程恢复回来
                    restoreDeviceManage(deviceId)
                }
                // 留出时间让调用方把 controller 写入运行态，避免排队中的预览进程插空启动
                setTimeout(() => mirrorStarting.delete(deviceId), 1500)
            }
        },
        async buildMirrorArgs(device: DeviceRecord, option?: {appPackage?: string}): Promise<string[]> {
            const setting = {
                dimWhenMirror: await this.settingGet(device, 'dimWhenMirror', 'no'),
                alwaysTop: await this.settingGet(device, 'alwaysTop', 'no'),
                mirrorSound: await this.settingGet(device, 'mirrorSound', 'no'),
                videoBitRate: await this.settingGet(device, 'videoBitRate', '8M'),
                maxFps: await this.settingGet(device, 'maxFps', '60'),
                panelShow: await this.settingGet(device, 'panelShow', 'no'),
                windowBorderless: await this.settingGet(device, 'windowBorderless', 'no'),
            }

            // 自定义参数：全局参数在前，单机参数在后（后者可覆盖前者，scrcpy 后值优先）
            const globalScrcpyArgs = await $mapi.config.get('Device.scrcpyArgs', '')
            const deviceScrcpyArgs = device.setting?.scrcpyArgs || ''
            const customArgs = [
                ...ShellUtil.parseArgs(String(globalScrcpyArgs || '')),
                ...ShellUtil.parseArgs(String(deviceScrcpyArgs || '')),
            ]

            const args: string[] = []
            args.push('--stay-awake')
            if ('yes' === setting.alwaysTop) {
                args.push('--always-on-top')
            }
            if ('yes' === setting.windowBorderless) {
                args.push('--window-borderless')
            }
            if ('no' === setting.mirrorSound) {
                args.push('--no-audio')
            }
            if (setting.videoBitRate) {
                args.push('--video-bit-rate', setting.videoBitRate)
            }
            if (setting.maxFps) {
                args.push('--max-fps', setting.maxFps)
            }
            if (setting.dimWhenMirror === 'yes') {
                args.push('--turn-screen-off')
            }

            // 应用投屏：投屏内容为独立虚拟屏，不会修改手机的物理分辨率
            if (option?.appPackage) {
                const displaySize = String(device.setting?.appDisplaySize || '')
                const displayDpi = String(device.setting?.appDisplayDpi || '')
                // --new-display 的可选参数只能通过 `=` 传入（如 --new-display=720x1280/240）
                const displayArg = displaySize
                    ? `${displaySize}${displayDpi ? '/' + displayDpi : ''}`
                    : displayDpi
                      ? `/${displayDpi}`
                      : ''
                args.push(displayArg ? `--new-display=${displayArg}` : '--new-display')
                args.push(`--start-app=+${option.appPackage}`)
                // 输入法显示在投屏窗口，而不是手机主屏
                args.push('--display-ime-policy=local')
            }

            if (customArgs.length) {
                args.push(...customArgs)
            }

            // 主投屏同时负责发送设备卡片预览图（投屏期间不再单独启动预览进程）
            if (!option?.appPackage) {
                args.push('--linkandroid-preview-interval', '1000', '--linkandroid-preview-ratio', '30')
            }

            // 添加 WebSocket 服务器和面板参数
            const wsAddress = await $mapi.serve.getAddress()
            const wsUrl = `${wsAddress}/server?type=DeviceMirror&deviceId=${device.id}`
            args.push('--linkandroid-server', wsUrl)
            if (setting.panelShow === 'yes') {
                args.push('--linkandroid-panel-show')
            }
            return args
        },
        async settingGet(device: DeviceRecord, name: keyof DeviceSetting, defaultValue: string) {
            if (device.setting && name in device.setting) {
                if ('' !== device.setting[name] && undefined !== device.setting[name]) {
                    return device.setting[name]
                }
            }
            return await $mapi.config.get(`Device.${name}`, defaultValue)
        },
        // ─── Group management ──────────────────────────────────────────
        async loadGroups() {
            this.groups = await $mapi.storage.get('device', 'groups', [])
        },
        async syncGroups() {
            await $mapi.storage.set('device', 'groups', this.groups)
        },
        addGroup(name: string): string {
            const id = 'group_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)
            this.groups.push({id, name, deviceIds: []})
            this.syncGroups()
            return id
        },
        updateGroup(id: string, update: Partial<DeviceGroup>) {
            const group = this.groups.find((g) => g.id === id)
            if (!group) return
            Object.assign(group, update)
            this.syncGroups()
        },
        deleteGroup(id: string) {
            const idx = this.groups.findIndex((g) => g.id === id)
            if (idx === -1) return
            this.groups.splice(idx, 1)
            this.syncGroups()
        },
        async setDeviceGroups(deviceId: string, groupIds: string[]) {
            for (const group of this.groups) {
                const hasDevice = group.deviceIds.includes(deviceId)
                const shouldHave = groupIds.includes(group.id)
                if (hasDevice && !shouldHave) {
                    group.deviceIds = group.deviceIds.filter((id) => id !== deviceId)
                } else if (!hasDevice && shouldHave) {
                    group.deviceIds.push(deviceId)
                }
            }
            await this.syncGroups()
        },
    },
})

const device = deviceStore(store)
device.init().then(() => {})

export const useDeviceStore = () => {
    return device
}
