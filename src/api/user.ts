import {request,} from "../lib/api";

export function userInfoApi(): Promise<ApiResult<{
    apiToken: string,
    user: object,
    data: any
}>> {
    return request({
        url: "app_manager/user_info",
        method: "post"
    })
}
