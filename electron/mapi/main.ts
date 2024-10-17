import config from "./config/main";
import log from "./log/main";
import app from "./app/main";
import storage from "./storage";
import db from "./db/main";
import file from "./file/main";
import event from "./event/main";
import ui from "./ui";
import keys from "./keys/main";
import page from "./page/main";
import user from "./user/main";
import misc from "./misc/main";

const $mapi = {
    app,
    log,
    config,
    storage,
    db,
    file,
    event,
    ui,
    keys,
    page,
    user,
    misc
}

export const MAPI = {
    init() {
        $mapi.db.init()
        $mapi.event.init()
    },
    ready() {
        $mapi.keys.ready()
    },
    destroy() {
        $mapi.keys.destroy()
    }
}
