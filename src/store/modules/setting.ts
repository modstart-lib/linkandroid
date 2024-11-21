import {defineStore} from "pinia"
import store from "../index";
import {AppConfig} from "../../config";
import {computed} from "vue";
import {cloneDeep} from "lodash-es";

export const settingStore = defineStore("setting", {
    state() {
        return {
            version: AppConfig.version,
            basic: cloneDeep(AppConfig.basic),
            isDarkMode: false,
            config: {},
        }
    },
    actions: {
        async init() {
            window.__page.broadcasts['DarkModeChange'] = (data) => {
                this.isDarkMode = data.isDarkMode
                this.initDarkMode()
            }
            this.isDarkMode = await window.$mapi.app.isDarkMode()
            this.config = await window.$mapi.config.all()
            this.initDarkMode()
        },
        initDarkMode() {
            if (this.isDarkMode) {
                document.body.setAttribute('arco-theme', 'dark')
                document.body.setAttribute('data-theme', 'dark')
            } else {
                document.body.removeAttribute('arco-theme');
                document.body.removeAttribute('data-theme');
            }
        },
        async initBasic(basic: object) {
            this.basic = Object.assign(this.basic, basic)
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
