import {request} from '../lib/api'

export function userInfoApi(): Promise<
    ApiResult<{
        apiToken: string
        user: object
        data: Record<string, unknown>
        basic: object
    }>
> {
    return request({
        url: 'app_manager/user_info',
        method: 'post',
    })
}
