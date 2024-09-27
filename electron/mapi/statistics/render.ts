import {AppConfig} from "../../../src/config";
import {platformArch, platformName, platformUUID, platformVersion} from "../../lib/env";

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
    tickSendTimer = setTimeout(() => {
        tickSendTimer = null
        if (!tickDataList.length) {
            return
        }
        fetch(AppConfig.statisticsUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                data: tickDataList,
                version: AppConfig.version,
                uuid: platformUUID(),
                platform: {
                    name: platformName(),
                    version: platformVersion(),
                    arch: platformArch(),
                }
            })
        }).then(res => {
            // console.log('tickSend', tickDataList, res)
        }).catch(err => {

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
