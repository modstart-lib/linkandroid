import {AppConfig} from "../../../src/config";

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
                data: tickDataList
            })
        }).then(res => {
            // console.log('tickSend', tickDataList, res)
        })
        tickDataList = []
    }, 2000)
}

const tick = (name: string, data: any) => {
    tickDataList.push({
        name,
        data,
        version: AppConfig.version,
        platform: process.platform
    })
    tickSendAsync()
}

export default {
    tick
}
