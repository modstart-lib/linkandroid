import config from "./config/main";
import log from "./log/main";
import app from "./app/main";
import storage from "./storage";
import file from "./file/main";
import event from "./event/main";
import ui from "./ui";
import keys from "./keys/main";
import page from "./page/main";
import user from "./user/main";

const $mapi = {
    app,
    log,
    config,
    storage,
    file,
    event,
    ui,
    keys,
    page,
    user,
}

export const MAPI = {
    init() {
        $mapi.event.init()
    },
    ready() {
        $mapi.keys.ready()
    },
    destroy() {
        $mapi.keys.destroy()
    }
}
