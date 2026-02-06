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
import updater from "./updater/main";
import serve from "./serve/main";
import adb from "./adb/main";

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
    updater,
    serve,
    adb,
};

export const MAPI = {
    async init() {
        await $mapi.user.init();
        await $mapi.db.init();
        await $mapi.event.init();
        await $mapi.serve.start();
    },
    ready() {
        $mapi.keys.ready();
    },
    destroy() {
        $mapi.keys.destroy();
        $mapi.serve.stop();
    },
};
