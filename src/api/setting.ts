import {request,} from "../lib/api";

export function settingRequest(): Promise<ApiResult<{
    basic: object
}>> {
    return request({
        url: "app_manager/setting",
        method: "post"
    })
}
