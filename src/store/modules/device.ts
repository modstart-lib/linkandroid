import {defineStore} from "pinia"
import store from "../index";
import {DeviceRecord, EnumDeviceStatus} from "../../types/Device";
import {clone, cloneDeep} from "lodash-es";
import {toRaw} from "vue";
import {DeviceService} from "../../services/DeviceService";

export const deviceStore = defineStore("device", {
    state: () => ({
        records: [] as DeviceRecord[]
    }),
    actions: {
        async init() {
            await window.$mapi.storage.get("device", "records", [])
                .then((records) => {
                    this.records = records
                })
            setTimeout(async () => {
                await this.startWatch()
                await this.refresh()
                await this.updateScreenshot()
            }, 2000)
        },
        async startWatch() {
            await window.$mapi.adb.watch((type, data) => {
                // console.log('watch', type, data)
                this.refresh().then(() => {
                })
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
        async refresh() {
            const devices = await DeviceService.list()
            // this.records = []
            this.records.forEach((record) => {
                record.status = EnumDeviceStatus.WAIT_CONNECTING
            })
            let changed = false
            devices.forEach((device) => {
                device = clone(device)
                const record = this.records.find((record) => record.id === device.id)
                if (record) {
                    record.status = EnumDeviceStatus.CONNECTED
                    return
                }
                this.records.push(device)
                changed = true
            })
            this.records.forEach((record) => {
                if (record.status === EnumDeviceStatus.WAIT_CONNECTING) {
                    record.status = EnumDeviceStatus.DISCONNECTED
                }
            })
            if (changed) {
                await this.sync()
            }
        },
        async delete(device: DeviceRecord) {
            const index = this.records.findIndex((record) => record.id === device.id)
            if (index === -1) {
                return
            }
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
        async sync() {
            const savedRecords = toRaw(cloneDeep(this.records))
            savedRecords.forEach((record) => {
                record.status = EnumDeviceStatus.WAIT_CONNECTING
            })
            await window.$mapi.storage.set("device", "records", savedRecords)
        },
    }
})

const device = deviceStore(store)
device.init().then(() => {
})

export const useDeviceStore = () => {
    return device
}
