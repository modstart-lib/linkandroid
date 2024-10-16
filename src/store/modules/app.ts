import {defineStore} from "pinia"
import store from "../index";

export const appStore = defineStore("app", {
    state() {
        return {}
    },
    actions: {
        async init() {

        },
    }
})

export const app = appStore(store)
app.init().then(() => {
})

export const useAppStore = () => {
    return app
}
