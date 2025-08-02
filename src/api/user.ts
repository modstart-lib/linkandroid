import {request} from "../lib/api";

export function userInfoApi(): Promise<
    ApiResult<{
        apiToken: string;
        user: object;
        data: any;
        basic: object;
    }>
> {
    return request({
        url: "app_manager/user_info",
        method: "post",
    });
}
