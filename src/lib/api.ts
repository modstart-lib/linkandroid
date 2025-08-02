import axios, {type AxiosInstance, type AxiosRequestConfig} from "axios";
import {merge} from "lodash-es";
import {Dialog} from "./dialog";
import {AppConfig} from "../config";
import {user} from "../store/modules/user";

function createService() {
    const service = axios.create();
    service.interceptors.request.use(
        config => config,
        error => Promise.reject(error)
    );
    service.interceptors.response.use(
        response => {
            const apiData = response.data;
            const responseType = response.request?.responseType;
            if (responseType === "blob" || responseType === "arraybuffer") return apiData;
            const code = apiData.code;
            // if (code === undefined) {
            //     ElMessage.error("非本系统的接口")
            //     return Promise.reject(new Error("非本系统的接口"))
            // }
            // switch (code) {
            //     case 0:
            //         // 本系统采用 code === 0 来表示没有业务错误
            //         return apiData
            //     case 401:
            //         // Token 过期时
            //         return logout()
            //     default:
            //         // 不是正确的 code
            //         ElMessage.error(apiData.message || "Error")
            //         return Promise.reject(new Error("Error"))
            // }
            return apiData;
        },
        error => {
            return Promise.reject(error);
        }
    );
    return service;
}

function createRequest(service: AxiosInstance) {
    return function <T>(config: AxiosRequestConfig): Promise<T> {
        const defaultConfig = {
            headers: {
                "User-Agent": window.$mapi.app.getUserAgent(),
                "Api-Token": user.apiToken ? user.apiToken : undefined,
                "Content-Type": "application/json",
            },
            timeout: 60 * 1000,
            baseURL: AppConfig.apiBaseUrl,
            data: {},
        };
        // 将默认配置 defaultConfig 和传入的自定义配置 config 进行合并成为 mergeConfig
        const mergeConfig = merge(defaultConfig, config);
        return service(mergeConfig).then(response => response as T);
    };
}

const service = createService();

export const request = createRequest(service);

export const defaultResponseProcessor = (
    res: ApiResult<any>,
    success: Function | null = null,
    error: Function | null = null
) => {
    if (res.code) {
        if (error) {
            if (!error(res)) {
                Dialog.tipError(res.msg);
            }
        } else {
            Dialog.tipError(res.msg);
        }
    } else {
        if (success) {
            if (success(res)) {
                if (res.msg) {
                    Dialog.tipSuccess(res.msg);
                }
            }
        } else {
            if (res.msg) {
                Dialog.tipSuccess(res.msg);
            }
        }
    }
};
