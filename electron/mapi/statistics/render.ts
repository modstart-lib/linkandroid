import {AppConfig} from "../../../src/config";
import {memoryInfo, platformArch, platformName, platformUUID, platformVersion} from "../../lib/env";
import {post} from "../../lib/api";

let tickDataList = []

let tickSendTimer = null

const tickSendAsync = () => {
    if (tickSendTimer) {
        clearTimeout(tickSendTimer)
        tickSendTimer = null
    }
    if (!AppConfig.statisticsUrl) {
        tickDataList = []
        return
    }
    tickSendTimer = setTimeout(async () => {
        tickSendTimer = null
        if (!tickDataList.length) {
            return
        }
        // console.log('tickSend', JSON.stringify(tickDataList))
        post(AppConfig.statisticsUrl, {
            data: tickDataList,
            version: AppConfig.version,
            uuid: platformUUID(),
            platform: {
                name: platformName(),
                version: platformVersion(),
                arch: platformArch(),
                mem: memoryInfo(),
            }
        }).then(res => {
            // console.log('tickSend', tickDataList, res)
        }).catch(err => {
            // console.error('tickSend', tickDataList, err)
        })
        tickDataList = []
    }, 2000)
}

const tick = (name: string, data: any) => {
    tickDataList.push({
        name,
        data,
    })
    tickSendAsync()
}

export default {
    tick
}
