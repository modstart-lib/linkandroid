import {createApp} from "vue";
import App from "./App.vue";
import router from "./router";
import store from "./store";

import ArcoVue, {Message} from "@arco-design/web-vue";
import ArcoVueIcon from "@arco-design/web-vue/es/icon";
import "@arco-design/web-vue/dist/arco.css";

import {i18n, t} from "./lang";

import "./style.less";
import {Dialog} from "./lib/dialog";

import {CommonComponents} from "./components/common";
import {TaskManager} from "./task";
import {useSettingStore} from "./store/modules/setting";

const settingStore = useSettingStore();

const app = createApp(App);
app.use(ArcoVue);
app.use(ArcoVueIcon);
app.use(CommonComponents);
app.use(i18n);
app.use(store);
app.use(router);
Message._context = app._context;
app.config.globalProperties.$mapi = window.$mapi;
app.config.globalProperties.$dialog = Dialog;
app.config.globalProperties.$t = t as any;
TaskManager.init();

app.mount("#app").$nextTick(() => {
    postMessage({payload: "removeLoading"}, "*");
});
