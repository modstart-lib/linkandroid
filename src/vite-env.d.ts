/// <reference types="vite/client" />
import {Dialog} from "./lib/dialog";

declare module "*.vue" {
    import type {DefineComponent} from "vue";
    const component: DefineComponent<{}, {}, any>;
    export default component;
}

declare module "@vue/runtime-core" {
    interface ComponentCustomProperties {
        $mapi: typeof window.$mapi;
        $dialog: typeof Dialog;
        $t: typeof import("vue-i18n").GlobalTranslate;
    }
}
