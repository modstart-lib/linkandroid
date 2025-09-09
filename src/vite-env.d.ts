/// <reference types="vite/client" />
import type {Dialog} from "./lib/dialog";
import type {Router} from 'vue-router';

declare module "*.vue" {
    import type {DefineComponent} from "vue";
    const component: DefineComponent<{}, {}, any>;
    export default component;
}

declare module "@vue/runtime-core" {
    interface ComponentCustomProperties {
        $router: Router;
        $dialog: Dialog;
        $t: typeof import("vue-i18n").GlobalTranslate;
    }
}
