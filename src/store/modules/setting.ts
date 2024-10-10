import {defineStore} from "pinia"
import store from "../index";
import {AppConfig} from "../../config";
import {computed} from "vue";

export const settingStore = defineStore("setting", {
    state() {
        return {
            version: AppConfig.version,
            config: {},
        }
    },
    actions: {
        async init() {
            this.config = await window.$mapi.config.all()
        },
        async setConfig(key: string, value: any) {
            this.config[key] = value
            await window.$mapi.config.set(key, value)
        },
        async onConfigChange(key: string, value: any) {
            this.config[key] = value
            await window.$mapi.config.set(key, value)
        },
        configGet(key: string, defaultValue: any = null) {
            return computed(() => {
                if (key in this.config) {
                    return this.config[key]
                }
                return defaultValue
            })
        },
    }
})

const setting = settingStore(store)
setting.init().then(() => {
})

export const useSettingStore = () => {
    return setting
}
