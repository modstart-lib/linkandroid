import config from "./config/main";
import log from "./log";
import app from "./app";
import storage from "./storage";
import file from "./file/main";
import event from "./event";
import ui from "./ui";
import keys from "./keys/main";

const $mapi = {
    app,
    log,
    config,
    storage,
    file,
    event,
    ui,
    keys,
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
