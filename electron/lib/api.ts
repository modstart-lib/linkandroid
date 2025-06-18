import Apps from "../mapi/app";

export type ResultType<T> = {
    // should follow the rules:
    // <0 business error
    // =0 success
    // 10000 error ( network error, server error, etc. )
    code: number,
    msg: string,
    data?: T
}

export const post = async (url: string, data: any) => {
    data = data || {}
    const userAgent = Apps.getUserAgent()
    data['AppManagerUserAgent'] = userAgent
    return await fetch(url, {
        method: 'POST',
        headers: {
            'User-Agent': userAgent,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    })
}
