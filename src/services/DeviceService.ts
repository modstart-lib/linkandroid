import {DeviceRecord, EnumDeviceStatus} from "../types/Device";


export const DeviceService = {
    async list(): Promise<DeviceRecord[]> {
        const res = await window.$mapi.adb.devices()
        const data: DeviceRecord[] = []
        for (const d of res || []) {
            data.push({
                id: d.id,
                status: EnumDeviceStatus.CONNECTED,
                name: d.model ? d.model.split(':')[1] : d.id,
                raw: d
            } as DeviceRecord)
        }
        return data
    }
}
