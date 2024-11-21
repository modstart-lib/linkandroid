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
            config: {
                darkMode: '' as 'light' | 'dark' | '',
            },
        }
    },
    actions: {
        async init() {
            window.__page.broadcasts['DarkModeChange'] = (data) => {
                this.isDarkMode = data.isDarkMode
                this.setupDarkMode()
            }
            this.isDarkMode = await window.$mapi.app.isDarkMode()
            this.config = await window.$mapi.config.all()
            this.setupDarkMode()
        },
        shouldDarkMode() {
            const darkMode = this.config['darkMode'] || ''
            if ('dark' === darkMode) {
                return true
            } else if ('light' === darkMode) {
                return false
            }
            return this.isDarkMode
        },
        setupDarkMode() {
            // console.log('setupDarkMode')
            if (this.shouldDarkMode()) {
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
            // console.log('setConfig', key, value)
            this.config[key] = value
            await window.$mapi.config.set(key, value)
            if ('darkMode' === key) {
                setTimeout(() => this.setupDarkMode(), 100)
            }
        },
        async onConfigChange(key: string, value: any) {
            return await this.setConfig(key, value)
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
setting.init().then()

export const useSettingStore = () => {
    return setting
}
