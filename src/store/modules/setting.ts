import {defineStore} from "pinia"
import store from "../index";
import {AppConfig} from "../../config";

export const settingStore = defineStore("setting", {
    state() {
        return {
            version: AppConfig.version,
        }
    },
    actions: {

    }
})

export const useSettingStore = () => {
    return settingStore(store)
}
