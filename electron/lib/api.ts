import {AppConfig} from "../../src/config";
import Apps from "../mapi/app";

export type ResultType<T> = {
    code: number,
    msg: string,
    data?: T
}

export const post = async (url: string, data: any) => {
    return await fetch(url, {
        method: 'POST',
        headers: {
            'User-Agent': Apps.getUserAgent(),
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    })
}
