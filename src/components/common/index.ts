import MLoading from "./MLoading.vue";
import MEmpty from "./MEmpty.vue";

export const CommonComponents = {
    install(Vue: any) {
        Vue.component("m-loading", MLoading);
        Vue.component("m-empty", MEmpty);
    },
};
