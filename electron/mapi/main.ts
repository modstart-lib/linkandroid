import config from './config/main'
import log from './log/main'
import app from './app/main'
import storage from './storage/main'
import db from './db/main'
import file from './file/main'
import event from './event/main'
import ui from './ui'
import keys from './keys/main'
import user from './user/main'
import misc from './misc/main'
import updater from './updater/main'
import serve from './serve/main'
import adb from './adb/main'
import httpserver from './httpserver/main'
import power from './power/main'
import task from './task/main'
import project from './project/main'
import pyenv from './pyenv/main'

import opencodeAgent from './opencode-agent/main'
import {startAgentMaintenance} from './opencode-agent/maintain'

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
    httpserver,
    power,
    task,
    project,
    pyenv,
    
    opencodeAgent,
}

export const MAPI = {
    async init() {
        await $mapi.user.init()
        await $mapi.db.init()
        await $mapi.project.ensureMigrated()
        await $mapi.event.init()
        await $mapi.serve.start()
        await $mapi.httpserver.start()
        $mapi.opencodeAgent.register()
    },
    ready() {
        $mapi.keys.ready()
        // 启动定时任务调度器
        $mapi.task.start()
        startAgentMaintenance()
    },
    destroy() {
        $mapi.keys.destroy()
        $mapi.task.stop()
        $mapi.opencodeAgent.destroy()
        $mapi.serve.stop()
        $mapi.httpserver.stop()
    },
}
