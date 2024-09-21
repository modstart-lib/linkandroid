import {exec as _exec, spawn} from 'node:child_process'
import util from 'node:util'
import {Adb} from '@devicefarmer/adbkit'
import {extraResolve} from "../../util/path";
import Config from "../config/render";
import {FileUtil, TimeUtil} from "../../lib/util";
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

const adbSpawnShell = async (command: string, option: {
    stdout: Function,
    stderr: Function,
    success: Function,
    error: Function,
} | null = null) => {
    option = option || {} as any
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
    spawnProcess.on('close', (code) => {
        if (code === 0 || code === null) {
            setTimeout(() => {
                option.success && option.success(code)
            }, 10)
        } else {
            option.error && option.error(`Command failed with code ${code}`)
        }
    })
    spawnProcess.on('error', (err) => {
        option.error && option.error(err)
    })
    return {
        stop: () => {
            spawnProcess.kill('SIGINT')
        }
    }
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

const screenrecord = async (deviceId: string, option?: {
    progress: (type: 'error' | 'success', data: any) => {} | null
}) => {
    option = option || {} as any
    const controller = {
        stop: null as Function | null,
        devicePath: null as string | null,
    }
    controller.devicePath = '/sdcard/LinkAndroid_screenshot_' + TimeUtil.timestampInMs() + '.mp4'
    const shellControl = await adbSpawnShell(
        `-s "${deviceId}" shell screenrecord "${controller.devicePath}"`,
        {
            stdout: (data) => {
                console.log('screenrecord.stdout', data)
            },
            stderr: (data) => {
                console.log('screenrecord.stderr', data)
            },
            success: (code) => {
                option.progress?.('success', {})
            },
            error: (err) => {
                option.progress?.('error', {
                    err,
                })
            }
        })
    controller.stop = () => {
        shellControl.stop()
    }
    return controller
}

const install = async (id: string, path: string) => {
    return (await getClient()).getDevice(id).install(path)
}

const uninstall = async (id: string, pkg: string) => {
    return (await getClient()).getDevice(id).uninstall(pkg)
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

const filePull = async (id: string, devicePath: string, localPath: string, option: {
    progress: Function | null
} = null) => {
    const {progress} = option || {}
    const transfer = await (await getClient()).getDevice(id).pull(devicePath)
    transfer.on('progress', (stats) => {
        // console.log('filePull.progress', stats)
        progress?.(stats)
    })
    return new Promise((resolve, reject) => {
        transfer.on('end', () => {
            // console.log('filePull.end')
            resolve({
                devicePath,
                localPath,
            })
        })
        transfer.on('error', (err) => {
            // console.log('filePull.error', err)
            reject(err)
        })
        transfer.pipe(fs.createWriteStream(localPath))
    })
}

const fileDelete = async (id: string, devicePath: string) => {
    await adbShell(`-s ${id} shell rm -rf '${devicePath}'`)
}

const listApps = async (id: string) => {
    const res = await shell(id, 'pm list packages -3')
    const records = res.split('\n').filter(item => item)
        .map(item => item.replace('package:', ''))
        .map(item => ({
            id: item,
            name: item,
        }))
    return records
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
    screenrecord,
    install,
    uninstall,
    isInstalled,
    version,
    watch,
    fileList,
    filePush,
    filePull,
    fileDelete,
    listApps,
}

export const ADB = {
    getBinPath
}
