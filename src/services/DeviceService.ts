import {DeviceRecord, EnumDeviceStatus, EnumDeviceType} from "../types/Device";
import {isIPWithPort} from "../lib/linkandroid";


export const DeviceService = {
    async list(): Promise<DeviceRecord[]> {
        const res = await window.$mapi.adb.devices()
        const data: DeviceRecord[] = []
        for (const d of res || []) {
            data.push({
                id: d.id,
                type: isIPWithPort(d.id) ? EnumDeviceType.WIFI : EnumDeviceType.USB,
                status: EnumDeviceStatus.CONNECTED,
                name: d.model ? d.model.split(':')[1] : d.id,
                raw: d
            } as DeviceRecord)
        }
        return data
    }
}
