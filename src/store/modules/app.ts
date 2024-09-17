import {defineStore} from "pinia"
import store from "../index";

export const appStore = defineStore("app", {
    state() {
        return {
            // appRoot: null as string | null,
        }
    },
    actions: {
        setAppRoot(root: string) {
            // this.appRoot = root
        }
    }
})

export const useAppStore = () => {
    return appStore(store)
}
