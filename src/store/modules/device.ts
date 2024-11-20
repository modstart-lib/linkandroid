import {defineStore} from "pinia"
import store from "../index";
import {DeviceRecord, DeviceRuntime, EnumDeviceStatus, EnumDeviceType} from "../../types/Device";
import {cloneDeep} from "lodash-es";
import {computed, ComputedRef, ref, toRaw} from "vue";
import {isIPWithPort} from "../../lib/linkandroid";
import {Dialog} from "../../lib/dialog";
import {t} from "../../lang";
import {sleep} from "../../lib/util";
import {mapError} from "../../lib/error";
import {useSettingStore} from "./setting";

const deviceRuntime = ref<Map<string, DeviceRuntime>>(new Map())
const setting = useSettingStore()
const previewImageDefault = setting.configGet('Device.previewImage', 'yes')
const createDeviceStatus = (record: DeviceRecord): ComputedRef<EnumDeviceStatus> => {
    const id = record.id
    return computed(() => {
        return deviceRuntime.value?.get(id)?.status || EnumDeviceStatus.WAIT_CONNECTING
    })
}

const createDeviceRuntime = (record: DeviceRecord): ComputedRef<DeviceRuntime> => {
    const id = record.id
    return computed(() => {
        const value = deviceRuntime.value?.get(id)
        if (value) {
            return value
        }
        deviceRuntime.value?.set(id, {
            status: EnumDeviceStatus.WAIT_CONNECTING,
            mirrorController: null,
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
    runtime.previewImage = record.setting?.previewImage || previewImageDefault
}

// const getDeviceRuntime = (record: DeviceRecord): DeviceRuntime => {
//     const id = record.id
//     const value = deviceRuntime.value?.get(id)
//     if (value) {
//         return value
//     }
//     deviceRuntime.value?.set(id, {
//         status: EnumDeviceStatus.WAIT_CONNECTING,
//         mirrorController: null,
//         previewImage: record.setting?.previewImage || previewImageDefault,
//     } as DeviceRuntime)
//     return deviceRuntime.value?.get(id) as DeviceRuntime
// }
const deleteDeviceRuntime = (record: DeviceRecord) => {
    deviceRuntime.value?.delete(record.id)
}

export const deviceStore = defineStore("device", {
    state: () => ({
        records: [] as DeviceRecord[]
    }),
    actions: {
        async init() {
            await window.$mapi.storage.get("device", "records", [])
                .then((records) => {
                    records.forEach((record: DeviceRecord) => {
                        record.status = createDeviceStatus(record)
                        record.runtime = createDeviceRuntime(record)
                        record.screenshot = record.screenshot || null
                        record.setting = record.setting || {
                            dimWhenMirror: '',
                            alwaysTop: '',
                            mirrorSound: '',
                            previewImage: '',
                        }
                    })
                    this.records = records
                })
            await this.refresh()
            setTimeout(async () => {
                await this.startWatch()
                await this.updateScreenshot()
            }, 2000)
        },
        async startWatch() {
            await window.$mapi.adb.watch((type, data) => {
                // console.log('watch', type, data)
                this.refresh().then()
            })
        },
        async updateScreenshot() {
            for (let r of this.records) {
                if (r.status !== EnumDeviceStatus.CONNECTED) {
                    continue
                }
                try {
                    const res = await window.$mapi.adb.screencap(r.id)
                    await this.edit(r, {
                        screenshot: res ? `data:image/png;base64,${res}` : null
                    }, false)
                } catch (e) {
                    try {
                        await this.refresh()
                        break
                    } catch (ee) {
                    }
                }
            }
            setTimeout(async () => {
                await this.updateScreenshot()
            }, 5 * 1000)
        },
        async connectedDevices(): Promise<DeviceRecord[]> {
            const res = await window.$mapi.adb.devices()
            const data: DeviceRecord[] = []
            for (const d of res || []) {
                data.push({
                    id: d.id,
                    type: isIPWithPort(d.id) ? EnumDeviceType.WIFI : EnumDeviceType.USB,
                    name: d.model ? d.model.split(':')[1] : d.id,
                    raw: d,
                    status: createDeviceStatus(d),
                    runtime: createDeviceRuntime(d),
                    screenshot: d.screenshot || null,
                    setting: {
                        dimWhenMirror: '',
                        alwaysTop: '',
                        mirrorSound: '',
                        previewImage: '',
                    },
                })
            }
            return data
        },
        async refresh() {
            const connectedDevices = await this.connectedDevices()
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
                        runtime: createDeviceRuntime(device),
                        screenshot: null,
                        setting: {
                            dimWhenMirror: '',
                            alwaysTop: '',
                            mirrorSound: '',
                            previewImage: '',
                        },
                    }
                    this.records.unshift(record)
                    changed = true
                }
            }
            // 设置已连接的设备状态
            const connectedDeviceIds = connectedDevices.map((d) => d.id)
            for (const record of this.records) {
                const runtime = createDeviceRuntime(record)
                if (connectedDeviceIds.includes(record.id)) {
                    if (runtime.value.status !== EnumDeviceStatus.CONNECTED) {
                        runtime.value.status = EnumDeviceStatus.CONNECTED
                        changed = true
                    }
                } else {
                    if (runtime.value.status !== EnumDeviceStatus.DISCONNECTED) {
                        runtime.value.status = EnumDeviceStatus.DISCONNECTED
                        changed = true
                    }
                }
            }
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
            deleteDeviceRuntime(device)
            this.records.splice(index, 1)
            await this.sync()
        },
        async edit(device: DeviceRecord, update: {}, sync: boolean = true) {
            const record = this.records.find((record) => record.id === device.id)
            if (!record) {
                return
            }
            for (let k in update) {
                record[k] = update[k]
            }
            if (sync) {
                await this.sync()
            }
        },
        async updateSetting(id: string, setting: any) {
            const record = this.records.find((record) => record.id === id)
            if (!record) {
                return
            }
            record.setting = Object.assign(record.setting || {}, setting)
            updateDeviceRuntime(record)
            await this.sync()
        },
        async sync() {
            const savedRecords = toRaw(cloneDeep(this.records))
            savedRecords.forEach((record) => {
                record.runtime = undefined
                record.status = undefined
            })
            await window.$mapi.storage.set("device", "records", savedRecords)
        },
        async doTop(index: number) {
            const record = this.records[index]
            this.records.splice(index, 1)
            this.records.unshift(record)
            await this.sync()
        },
        async doMirror(device: DeviceRecord) {
            const runtime = createDeviceRuntime(device)
            if (runtime.value.status !== EnumDeviceStatus.CONNECTED) {
                throw new Error('DeviceNotConnected')
            }
            if (runtime.value.mirrorController) {
                try {
                    runtime.value.mirrorController.stop()
                } catch (e) {
                }
                return
            }
            Dialog.loadingOn(t('正在投屏'))
            const setting = {
                dimWhenMirror: await this.settingGet(device, 'dimWhenMirror', 'no'),
                alwaysTop: await this.settingGet(device, 'alwaysTop', 'no'),
                mirrorSound: await this.settingGet(device, 'mirrorSound', 'no'),
            }
            console.log('setting', setting)
            const args: string[] = []
            args.push('--stay-awake')
            if ('yes' === setting.alwaysTop) {
                args.push('--always-on-top')
            }
            if ('no' === setting.mirrorSound) {
                args.push('--no-audio')
            }
            const mirrorStart = async () => {
                if ('yes' === setting.dimWhenMirror) {
                    try {
                        const result = await window.$mapi.adb.adbShell('shell settings get system screen_brightness', device.id)
                        // @ts-ignore
                        device.runtime.screenBrightness = parseInt(result?.stdout)
                        console.log('screenBrightness.backup', device.runtime.screenBrightness)
                        await window.$mapi.adb.adbShell('shell settings put system screen_brightness 1', device.id)
                    } catch (e) {
                        console.error('dimWhenMirror.error', e)
                    }
                }
            }
            const mirrorEnd = async () => {
                if ('yes' === setting.dimWhenMirror) {
                    console.log('screenBrightness.restore', device.runtime.screenBrightness)
                    if (device.runtime.screenBrightness) {
                        await window.$mapi.adb.adbShell(`shell settings put system screen_brightness ${device.runtime.screenBrightness}`, device.id)
                    }
                }
            }
            try {
                runtime.value.mirrorController = await window.$mapi.scrcpy.mirror(device.id, {
                    title: device.name as string,
                    args: args.join(' '),
                    stdout: (data: string) => {
                        console.log('mirror.stdout', data)
                    },
                    stderr: (data: string) => {
                        console.error('mirror.stderr', data)
                    },
                    success: (code: number) => {
                        console.log('mirror.success', code)
                        runtime.value.mirrorController = null
                        mirrorEnd().then()
                    },
                    error: (code: number) => {
                        console.error('mirror.error', code)
                        runtime.value.mirrorController = null
                        mirrorEnd().then()
                    }
                })
                await sleep(1000)
                Dialog.tipSuccess(t('投屏成功'))
                await mirrorStart()
            } catch (error) {
                Dialog.tipError(mapError(error))
            } finally {
                Dialog.loadingOff()
            }
        },
        async settingGet(device: DeviceRecord, name: string, defaultValue: any) {
            if (device.setting && name in device.setting) {
                if ('' !== device.setting[name]) {
                    return device.setting[name]
                }
            }
            return await window.$mapi.config.get(`Device.${name}`, defaultValue)
        }
    }
})

const device = deviceStore(store)
device.init().then(() => {
})

export const useDeviceStore = () => {
    return device
}
