import {defineStore} from 'pinia'
import store from '../index'
import {AppConfig} from '../../config'
import {useSettingStore} from './setting'

const setting = useSettingStore()

export const userStore = defineStore('user', {
    state() {
        return {
            isInit: false,
            lastSavedJson: '',
            apiToken: null as string | null,
            user: {
                id: null as string | null,
                name: null as string | null,
                avatar: null as string | null,
                deviceCode: null as string | null,
            },
            data: {
                vip: {
                    id: null as string | null,
                    flag: null as string | null,
                    title: null as string | null,
                    isDefault: true,
                },
                functions: {} as Record<string, any>,
            } as {
                vip: {
                    id: string | null
                    flag: string | null
                    title: string | null
                    isDefault: boolean
                }
                functions: Record<string, any>
                [key: string]: any
            },
            basic: {} as {
                [key: string]: any
            },
        }
    },
    actions: {
        async init() {
            await this.load()
        },
        async load() {
            const {apiToken, user, data, basic} = await window.$mapi.user.get()
            this.apiToken = apiToken
            this.user = Object.assign(this.user, user)
            this.data = data as any
            this.basic = basic
            await setting.initBasic(this.basic)
            this.isInit = true
        },
        onChangeBroadcast() {
            this.load().then()
        },
        async waitInit() {
            if (this.isInit) {
                return
            }
            await new Promise((resolve) => {
                const timer = setInterval(() => {
                    if (this.isInit) {
                        clearInterval(timer)
                        resolve(undefined)
                    }
                }, 100)
            })
        },
        async webUrl() {
            await this.waitInit()
            let param: string[] = []
            if (this.apiToken) {
                param.push(`api_token=${this.apiToken}`)
            }
            if (setting.shouldDarkMode()) {
                param.push('is_dark=1')
            }
            return `${AppConfig.apiBaseUrl}/app_manager/user_web?${param.join('&')}`
        },
    },
})

export const user = userStore(store)

user.init().then()

window.__page.onBroadcast('UserChange', user.onChangeBroadcast)

export const useUserStore = () => {
    return user
}
