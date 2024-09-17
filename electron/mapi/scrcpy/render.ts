import {exec as _exec, spawn} from 'node:child_process'
import util from 'node:util'
import which from 'which'
import Config from "../config";
import {extraResolve} from "../../util/path";
import {ADB} from '../adb/render'

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

const shell = async (command: any, options: { stdout: Function, stderr: Function }) => {
    const spawnPath = await getBinPath()
    const adb = await ADB.getBinPath()
    const args = command.split(' ')
    const scrcpyProcess = spawn(`"${spawnPath}"`, args, {
        env: {...process.env, adb},
        shell: true,
        encoding: 'utf8',
    } as any)
    // console.log(scrcpyProcess.pid)
    scrcpyProcess.stdout.on('data', (data) => {
        const stringData = data.toString()
        if (options && options.stdout) {
            options.stdout(stringData, scrcpyProcess)
        }
    })
    const stderrList = []
    scrcpyProcess.stderr.on('data', (data) => {
        const stringData = data.toString()
        stderrList.push(stringData)
        if (options && options.stderr) {
            options.stderr(stringData, scrcpyProcess)
        }
    })
    return new Promise((resolve, reject) => {
        scrcpyProcess.on('close', (code) => {
            if (code === 0) {
                resolve(null)
            } else {
                reject(new Error(stderrList.join(',') || `Command failed with code ${code}`),)
            }
        })
        scrcpyProcess.on('error', (err) => {
            reject(err)
        })
    })
}

const execShell = async (command: string) => {
    const spawnPath = await getBinPath()
    const adb = await ADB.getBinPath()
    const res = exec(`"${spawnPath}" ${command}`, {
        env: {...process.env, adb},
        shell: true,
        encoding: 'utf8',
    } as any)
    return res
}

const mirror = async (
    serial: string,
    options: { title: string, args: string, exec: boolean, option: { stdout: Function, stderr: Function } }
) => {
    const mirrorShell = options.exec ? execShell : shell
    return mirrorShell(
        `--serial="${serial}" --window-title="${options.title}" ${options.args}`,
        options.option
    )
}

export default {
    getBinPath,
    setBinPath,
    mirror,
}
