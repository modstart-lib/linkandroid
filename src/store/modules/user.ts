import {defineStore} from "pinia"
import store from "../index";
import {userInfoApi} from "../../api/user";
import {toRaw} from "vue";
import {AppConfig} from "../../config";

export const userStore = defineStore("user", {
    state() {
        return {
            isInit: false,
            lastSavedJson: '',
            apiToken: null as string | null,
            user: {
                id: null as string | null,
                name: null as string | null,
                avatar: null as string | null,
            },
            data: null as any,
        }
    },
    actions: {
        async init() {
            await this.load()
            await this.refreshUserInfo()
        },
        async load() {
            const {apiToken, user, data} = await window.$mapi.user.get()
            this.apiToken = apiToken
            this.user = Object.assign(this.user, user)
            this.data = data
            this.isInit = true
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
        async refreshUserInfo() {
            const result = await userInfoApi()
            // console.log('refreshUserInfo', result)
            this.apiToken = result.data.apiToken
            this.user = Object.assign(this.user, result.data.user)
            this.data = result.data.data
            const saved = toRaw({
                apiToken: this.apiToken,
                user: toRaw(this.user as any),
                data: toRaw(this.data)
            })
            const savedJson = JSON.stringify(saved)
            if (!this.lastSavedJson || this.lastSavedJson !== savedJson) {
                this.lastSavedJson = savedJson
                await window.$mapi.user.save(saved)
            }
        },
        async webUrl() {
            await this.waitInit()
            return `${AppConfig.apiBaseUrl}/app_manager/user_web?api_token=${this.apiToken}`
        }
    }
})

export const user = userStore(store)

user.init().then(() => {
})

window['__callPage']['doRefreshUserInfo'] = async () => {
    await user.refreshUserInfo()
}

export const useUserStore = () => {
    return user
}
