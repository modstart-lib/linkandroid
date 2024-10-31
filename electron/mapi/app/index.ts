import util from "node:util";
import net from "node:net";
import {exec as _exec, spawn} from "node:child_process";
import {isLinux, isMac, isWin} from "../../lib/env";
import {Log} from "../log/index";
import iconv from "iconv-lite";

const exec = util.promisify(_exec)

const shell = async (command: string, option?: {
    cwd?: string,
    encoding?: string,
}) => {
    option = Object.assign({
        cwd: process.cwd(),
        encoding: 'binary',
    }, option)
    return exec(command, {
        env: {...process.env},
        shell: true,
        encoding: option['encoding'],
        cwd: option['cwd'],
    } as any)
}

const spawnShell = async (command: string | string[], option: {
    stdout?: (data: string, process: any) => void,
    stderr?: (data: string, process: any) => void,
    success?: (process: any) => void,
    error?: (msg: string, exitCode: number, process: any) => void,
    cwd?: string,
    outputEncoding?: string,
    env?: Record<string, any>,
} | null = null): Promise<{
    stop: () => void,
    send: (data: any) => void,
    result: () => Promise<string>
}> => {
    option = Object.assign({
        cwd: process.cwd(),
        outputEncoding: isWin ? 'cp936' : 'utf8',
        env: {},
    }, option)
    let commandEntry = '', args = []
    if (Array.isArray(command)) {
        commandEntry = command[0]
        args = command.slice(1)
    } else {
        args = command.split(' ')
        commandEntry = args.shift() as string
    }
    Log.info('App.spawnShell', {
        commandEntry, args, option: {
            cwd: option['cwd'],
            outputEncoding: option['outputEncoding'],
        }
    })
    const spawnProcess = spawn(commandEntry, args, {
        env: {...process.env, ...option.env},
        cwd: option['cwd'],
        shell: true,
        encoding: 'binary',
    } as any)
    let end = false
    let isSuccess = false
    let exitCode = -1
    const stdoutList: string[] = []
    const stderrList: string[] = []
    const outputStringConvert = (data: any) => {
        if (option.outputEncoding === 'utf8') {
            return data.toString()
        }
        // convert outputEncoding(cp936) to utf8
        return iconv.decode(Buffer.from(data, 'binary'), option.outputEncoding)
    }
    spawnProcess.stdout?.on('data', (data) => {
        // console.log('App.spawnShell.stdout', data)
        let dataString = outputStringConvert(data)
        Log.info('App.spawnShell.stdout', dataString)
        stdoutList.push(dataString)
        option.stdout?.(dataString, spawnProcess)
    })
    spawnProcess.stderr?.on('data', (data) => {
        // console.log('App.spawnShell.stderr', data)
        let dataString = outputStringConvert(data)
        Log.info('App.spawnShell.stderr', dataString)
        stderrList.push(dataString)
        option.stderr?.(dataString, spawnProcess)
    })
    spawnProcess.on('exit', (code) => {
        // console.log('App.spawnShell.exit', code)
        Log.info('App.spawnShell.exit', JSON.stringify(code))
        exitCode = code
        if (isWin) {
            if (0 === code || 1 === code) {
                isSuccess = true
            }
        } else {
            if (null === code || 0 === code) {
                isSuccess = true
            }
        }
        if (isSuccess) {
            option.success?.(spawnProcess)
        } else {
            option.error?.(`command ${command} failed with code ${code}`, exitCode, spawnProcess)
        }
        end = true
    })
    spawnProcess.on('error', (err) => {
        // console.log('App.spawnShell.error', err)
        Log.info('App.spawnShell.error', err)
        option.error?.(err.toString(), -1, spawnProcess)
        end = true
    })
    return {
        stop: () => {
            Log.info('App.spawnShell.stop')
            if (isWin) {
                _exec(`taskkill /pid ${spawnProcess.pid} /T /F`, (err, stdout, stderr) => {
                    Log.info('App.spawnShell.stop.taskkill', JSON.parse(JSON.stringify({err, stdout, stderr})))
                })
            } else {
                spawnProcess.kill('SIGINT')
            }
        },
        send: (data) => {
            Log.info('App.spawnShell.send', data)
            spawnProcess.stdin.write(data)
        },
        result: async (): Promise<string> => {
            if (end) {
                return stdoutList.join('') + stderrList.join('')
            }
            return new Promise((resolve, reject) => {
                spawnProcess.on('exit', (code) => {
                    const watchEnd = () => {
                        setTimeout(() => {
                            if (!end) {
                                watchEnd()
                                return
                            }
                            if (isSuccess) {
                                resolve(stdoutList.join('') + stderrList.join(''))
                            } else {
                                reject(`command ${command} failed with code ${exitCode}`)
                            }
                        }, 10)
                    }
                    watchEnd()
                })
            })
        }
    }
}

/**
 * 获取一个可用的端口
 * @param start 开始的端口
 */
const availablePort = async (start: number): Promise<number> => {
    for (let i = start; i < 65535; i++) {
        const available = await isPortAvailable(i, '0.0.0.0')
        const availableLocal = await isPortAvailable(i, '127.0.0.1')
        // console.log('isPortAvailable', i, available, availableLocal)
        if (available && availableLocal) {
            return i
        }
    }
    throw new Error('no available port')
}


const isPortAvailable = async (port: number, host?: string): Promise<boolean> => {
    return new Promise((resolve) => {
        const server = net.createServer()
        server.listen(port, host)
        server.on('listening', () => {
            server.close()
            resolve(true)
        })
        server.on('error', () => {
            resolve(false)
        })
    })
}

const fixExecutable = async (executable: string) => {
    if (isMac || isLinux) {
        // chmod +x executable
        await shell(`chmod +x "${executable}"`)
    }
}

export const Apps = {
    shell,
    spawnShell,
    availablePort,
    isPortAvailable,
}

export default {
    shell,
    spawnShell,
    availablePort,
    fixExecutable,
}
