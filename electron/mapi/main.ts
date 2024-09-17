import config from "./config";
import log from "./log";
import app from "./app";
import storage from "./storage";
import file from "./file/main";
import event from "./event";
import ui from "./ui";
import updater from "./updater";
import keys from "./keys/main";
import statistics from "./statistics";

const $mapi = {
    app,
    log,
    config,
    storage,
    file,
    event,
    ui,
    updater,
    keys,
    statistics
}

export const MAPI = {
    init() {
        $mapi.event.init()
        $mapi.updater.init()
    },
    ready() {
        $mapi.keys.ready()
    },
    destroy() {
        $mapi.keys.destroy()
    }
}
