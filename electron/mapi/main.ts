import config from "./config/main";
import log from "./log/main";
import app from "./app/main";
import storage from "./storage/main";
import db from "./db/main";
import file from "./file/main";
import event from "./event/main";
import ui from "./ui";
import keys from "./keys/main";
import user from "./user/main";
import misc from "./misc/main";

// import server from "./server/main";

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
    user,
    misc,
    // server
}

export const MAPI = {
    init() {
        $mapi.user.init()
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
