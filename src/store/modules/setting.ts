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
                guideWatched: false as boolean,
                darkMode: '' as 'light' | 'dark' | 'auto',
            },
        }
    },
    actions: {
        async init() {
            this.isDarkMode = await window.$mapi.app.isDarkMode()
            this.config = await window.$mapi.config.all()
            this.setupDarkMode()
            // setTimeout(() => {
            //     if (!this.config.guideWatched) {
            //         window.$mapi.app.windowOpen('guide').then()
            //         this.setConfig('guideWatched', true).then()
            //     }
            // }, 2000)
        },
        onConfigChangeBroadcast(data: any) {
            (async () => {
                this.config = await window.$mapi.config.all()
                this.setupDarkMode()
            })()
        },
        onDarkModeChangeBroadcast(data: any) {
            this.isDarkMode = data.isDarkMode
            this.setupDarkMode()
        },
        shouldDarkMode() {
            const darkMode = this.config['darkMode'] || 'auto'
            if ('dark' === darkMode) {
                return true
            } else if ('light' === darkMode) {
                return false
            } else if ('auto' === darkMode) {
                return this.isDarkMode
            }
            return false
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

window.__page.onBroadcast('ConfigChange', setting.onConfigChangeBroadcast)
window.__page.onBroadcast('DarkModeChange', setting.onDarkModeChangeBroadcast)

export const useSettingStore = () => {
    return setting
}
