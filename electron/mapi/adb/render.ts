import {exec as _exec, spawn} from 'node:child_process'
import util from 'node:util'
import {Adb} from '@devicefarmer/adbkit'
import {extraResolve} from "../../util/path";
import Config from "../config";
import {FileUtil} from "../../lib/util";
import dayjs from "dayjs";
import fs from "node:fs";
import Client from "@devicefarmer/adbkit/dist/src/adb/client";

const exec = util.promisify(_exec)

let client = null
window.addEventListener('beforeunload', () => {
    destroy()
})

const destroy = () => {
    if (client) {
        client.kill()
        client = null
    }
}

const getBinPath = async () => {
    const binPath = await Config.get('common.adbPath')
    if (binPath) {
        return binPath
    }
    switch (process.platform) {
        case 'win32':
            return extraResolve('win/android-platform-tools/adb.exe')
        case 'darwin':
            return extraResolve('mac/android-platform-tools/adb')
        case 'linux':
            return extraResolve('linux/android-platform-tools/adb')
    }
}

const setBinPath = async (binPath: string) => {
    const binPathOld = await Config.get('common.adbPath')
    if (binPath === binPathOld) {
        return false
    }
    await Config.set('common.adbPath', binPath)
    destroy()
    return true
}

const getClient = async (): Promise<Client> => {
    if (!client) {
        client = Adb.createClient({
            bin: await getBinPath(),
        })
    }
    return client
}

const adbShell = async (command: string) => {
    const adbPath = await getBinPath()
    return exec(`"${adbPath}" ${command}`, {
        env: {...process.env},
        shell: true,
    } as any)
}

const adbSpawnShell = async (command: string, option: { stdout: Function, stderr: Function } | null = null) => {
    option = option || {stdout: null, stderr: null}
    const adbSpawnPath = await getBinPath()
    const args = command.split(' ')

    const spawnProcess = spawn(`"${adbSpawnPath}"`, args, {
        env: {...process.env},
        shell: true,
        encoding: 'utf8',
    } as any)
    if (spawnProcess) {
        spawnProcess.stdout?.on('data', (data) => {
            const stringData = data.toString()
            if (option.stdout) {
                option.stdout(stringData, spawnProcess)
            }
        })
        const stderrList = []
        spawnProcess.stderr?.on('data', (data) => {
            const stringData = data.toString()
            stderrList.push(stringData)
            if (option.stderr) {
                option.stderr(stringData, spawnProcess)
            }
        })
    }
    return new Promise((resolve, reject) => {
        spawnProcess.on('close', (code) => {
            if (code === 0) {
                resolve(true)
            } else {
                reject(new Error(`Command failed with code ${code}`),)
            }
        })
        spawnProcess.on('error', (err) => {
            reject(err)
        })
    })
}

const devices = async () => {
    return (await getClient()).listDevicesWithPaths()
}

const shell = async (id: string, command: string) => {
    const client = await getClient()
    const res = await client.getDevice(id).shell(command).then(Adb.util.readAll)
    return res.toString()
}

const connect = async (host: string, port?: number) => {
    await (await getClient()).connect(host, port)
}

const disconnect = async (host: string, port?: number) => {
    await (await getClient()).disconnect(host, port)
}

const getDeviceIP = async (id: string) => {
    try {
        const {stdout} = await adbShell(`-s ${id} shell ip -f inet addr show wlan0`)
        const reg = /inet ([0-9.]+)\/\d+/
        const match = stdout.toString().match(reg)
        const value = match[1]
        return value
    } catch (error) {
        console.warn('adb.getDeviceIP.error', error.message)
    }
    return null
}

const tcpip = async (id, port = 5555) => {
    return (await getClient()).getDevice(id).tcpip(port)
}

const screencap = async (deviceId: string) => {
    let fileStream = null
    try {
        const device = (await getClient()).getDevice(deviceId)
        fileStream = await device.screencap()
    } catch (error) {
        return null
    }
    if (!fileStream) {
        return null
    }
    return await FileUtil.streamToBase64(fileStream)
}

const install = async (id: string, path: string) => {
    return (await getClient()).getDevice(id).install(path)
}

const isInstalled = async (id: string, pkg: string) => {
    return (await getClient()).getDevice(id).isInstalled(pkg)
}

const version = async () => {
    return (await getClient()).version()
}

const watch = async (callback: Function) => {
    const tracker = await (await getClient()).trackDevices()
    tracker.on('add', async (device) => {
        callback('add', device)
    })
    tracker.on('remove', (device) => {
        callback('remove', device)
    })
    tracker.on('end', (ret) => {
        callback('end', ret)
    })
    tracker.on('error', (err) => {
        callback('error', err)
    })
    const close = () => tracker.end()
    return close
}

const fileList = async (id: string, filePath: string) => {
    const value = await (await getClient()).getDevice(id).readdir(filePath)
    return value.map(item => ({
        ...item,
        id: [filePath, item.name].join('/'),
        type: item.isFile() ? 'file' : 'directory',
        name: item.name,
        size: FileUtil.formatSize(item.size),
        updateTime: dayjs(item.mtime).format('YYYY-MM-DD HH:mm:ss'),
    }))
}

const filePush = async (id: string, localPath: string, devicePath: string, options: {
    progress: Function | null
} = null) => {
    const {progress} = options || {}
    const transfer = await (await getClient()).getDevice(id).push(localPath, devicePath)
    return new Promise((resolve, reject) => {
        transfer.on('progress', (stats) => {
            progress?.(stats)
        })
        transfer.on('end', () => {
            resolve({
                localPath,
                devicePath,
            })
        })
        transfer.on('error', (err) => {
            reject(err)
        })
    })
}

const filePull = async (id: string, devicePath: string, localPath: string, options: {
    progress: Function | null
} = null) => {
    const {progress} = options || {}
    const transfer = await (await getClient()).getDevice(id).pull(devicePath)
    return new Promise((resolve, reject) => {
        transfer.on('progress', (stats) => {
            progress?.(stats)
        })
        transfer.on('end', () => {
            resolve({
                localPath,
                devicePath,
            })
        })

        transfer.on('error', (err) => {
            reject(err)
        })
        transfer.pipe(fs.createWriteStream(localPath))
    })
}

const fileDelete = async (id: string, devicePath: string) => {
    await adbShell(`-s ${id} shell rm -rf '${devicePath}'`)
}

export default {
    getBinPath,
    setBinPath,
    adbShell,
    adbSpawnShell,
    devices,
    shell,
    connect,
    disconnect,
    getDeviceIP,
    tcpip,
    screencap,
    install,
    isInstalled,
    version,
    watch,
    fileList,
    filePush,
    filePull,
    fileDelete,
}

export const ADB = {
    getBinPath
}
