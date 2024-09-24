import util from "node:util";
import {exec as _exec, spawn} from "node:child_process";
import {isWin} from "../../util/path";
import {Log} from "../log/index";

const exec = util.promisify(_exec)

const shell = async (command: string) => {
    return exec(command, {
        env: {...process.env},
        shell: true,
        encoding: 'utf8',
    } as any)
}

const spawnShell = async (command: string, option: {
    stdout?: Function,
    stderr?: Function,
    success?: Function,
    error?: Function,
} | null = null): Promise<{
    stop: () => void,
    send: (data: any) => void,
    result: () => Promise<string>
}> => {
    option = option || {} as any
    let args = command.split(' ')
    const commandEntry = args.shift() as string
    Log.info('App.spawnShell', {commandEntry, args})
    const spawnProcess = spawn(commandEntry, args, {
        env: {...process.env},
        shell: true,
        encoding: 'utf8',
    } as any)
    // console.log('spawnProcess.start', spawnProcess)
    let end = false
    const stdoutList: string[] = []
    const stderrList: string[] = []
    // spawnProcess.stdout.setEncoding('utf8');
    spawnProcess.stdout?.on('data', (data) => {
        const stringData = data.toString()
        Log.info('App.spawnShell.stdout', stringData)
        stdoutList.push(stringData)
        option.stdout?.(stringData, spawnProcess)
    })
    // spawnProcess.stderr.setEncoding('utf8');
    spawnProcess.stderr?.on('data', (data) => {
        const stringData = data.toString()
        Log.info('App.spawnShell.stderr', stringData)
        stderrList.push(stringData)
        option.stderr?.(stringData, spawnProcess)
    })
    spawnProcess.on('message', (message) => {
        Log.info('App.spawnShell.message', message)
    });
    spawnProcess.on('spawn', (message) => {
        Log.info('App.spawnShell.spawn', message)
    })
    spawnProcess.on('close', (code) => {
        Log.info('App.spawnShell.close', JSON.stringify(code))
        if (isWin) {
            if (code === 1) {
                option.success?.(code)
            } else {
                option.error?.(`command ${command} failed with code ${code}`, code)
            }
        } else {
            if (code === 0 || code === null) {
                option.success?.(code)
            } else {
                option.error?.(`command ${command} failed with code ${code}`, code)
            }
        }
        end = true
    })
    spawnProcess.on('error', (err) => {
        Log.info('App.spawnShell.error', err)
        option.error?.(err)
        end = true
    })
    return {
        stop: () => {
            Log.info('App.spawnShell.stop')
            if (isWin) {
                _exec(`taskkill /pid ${spawnProcess.pid} /T /F`, (err, stdout, stderr) => {
                    console.log('taskkill', err, stdout, stderr)
                })
            } else {
                spawnProcess.kill('SIGINT')
            }
        },
        send: (data) => {
            spawnProcess.stdin.write(data)
        },
        result: async (): Promise<string> => {
            if (end) {
                return stdoutList.join('') + stderrList.join('')
            }
            return new Promise((resolve, reject) => {
                spawnProcess.on('close', (code) => {
                    Log.info('App.spawnShell.close', JSON.stringify(code))
                    if (code === 0 || code === null) {
                        resolve(stdoutList.join('') + stderrList.join(''))
                    } else {
                        reject(`command ${command} failed with code ${code}`)
                    }
                })
                spawnProcess.on('error', (err) => {
                    Log.info('App.spawnShell.error', err)
                    reject(err)
                })
            })
        }
    }
}

export const Apps = {
    shell,
    spawnShell,
}
