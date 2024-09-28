import {AppConfig} from "../../src/config";

export const post = async (url: string, data: any) => {
    return await fetch(AppConfig.statisticsUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    })
}
