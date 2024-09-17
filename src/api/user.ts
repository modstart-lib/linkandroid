import {request,} from "../lib/api";

export type LoginResponseData = ApiResult<{ token: string }>

export function loginApi() {
    return request<LoginResponseData>({
        url: "login",
        method: "post"
    })
}
