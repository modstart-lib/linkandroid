import {exec as _exec} from 'node:child_process'
import util from 'node:util'
import which from 'which'
import Config from "../config/render";
import {extraResolve} from "../../lib/env";
import {Apps} from "../app";

const exec = util.promisify(_exec)

const getBinPath = async () => {
    const binPath = await Config.get('common.scrcpyPath')
    if (binPath) {
        return binPath
    }
    switch (process.platform) {
        case 'win32':
            return extraResolve('win/scrcpy/scrcpy.exe')
        // case 'darwin':
        //     return extraResolve('mac/scrcpy/scrcpy')
        // case 'linux':
        //   return extraResolve('linux/scrcpy/scrcpy')
        default:
            return which.sync('scrcpy', {nothrow: true})
    }
}

const setBinPath = async (binPath: string) => {
    const binPathOld = await Config.get('common.scrcpyPath')
    if (binPath === binPathOld) {
        return false
    }
    await Config.set('common.scrcpyPath', binPath)
    return true
}

const shell = async (command: string) => {
    const scrcpyPath = await getBinPath()
    return await Apps.shell(`"${scrcpyPath}" ${command}`)
}

const spawnShell = async (command: string, option: {
    stdout?: Function,
    stderr?: Function,
    success?: Function,
    error?: Function,
} | null = null) => {
    const scrcpyPath = await getBinPath()
    return await Apps.spawnShell(`"${scrcpyPath}" ${command}`, option)
}

const mirror = async (
    serial: string,
    option: {
        title?: string,
        args?: string,
        stdout?: Function,
        stderr?: Function,
        success?: Function,
        error?: Function,
    },
) => {
    option = option || {}
    return spawnShell(`--serial="${serial}" --window-title="${option.title}" ${option.args}`, {
        stdout: option.stdout,
        stderr: option.stderr,
        success: option.success,
        error: option.error,
    })
}

export default {
    getBinPath,
    setBinPath,
    shell,
    spawnShell,
    mirror,
}
