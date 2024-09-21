import util from "node:util";
import {exec as _exec, spawn} from "node:child_process";


const exec = util.promisify(_exec)

const shell = async (command: string) => {
    return exec(command, {
        env: {...process.env},
        shell: true,
    } as any)
}

const spawnShell = async (command: string, option: {
    stdout: Function,
    stderr: Function,
    success: Function,
    error: Function,
} | null = null) => {
    option = option || {} as any
    // parse entry and args
    const args = command.split(' ')
    const commandEntry = args.shift() as string
    const spawnProcess = spawn(commandEntry, args, {
        env: {...process.env},
        shell: true,
        encoding: 'utf8',
    } as any)
    let end = false
    const stdoutList: string[] = []
    const stderrList: string[] = []
    if (spawnProcess) {
        spawnProcess.stdout?.on('data', (data) => {
            const stringData = data.toString()
            stdoutList.push(stringData)
            option.stdout?.(stringData, spawnProcess)
        })
        spawnProcess.stderr?.on('data', (data) => {
            const stringData = data.toString()
            stderrList.push(stringData)
            option.stderr?.(stringData, spawnProcess)
        })
    }
    spawnProcess.on('close', (code) => {
        if (code === 0 || code === null) {
            option.success?.(code)
        } else {
            option.error?.(`command ${command} failed with code ${code}`)
        }
        end = true
    })
    spawnProcess.on('error', (err) => {
        option.error?.(err)
        end = true
    })
    return {
        stop: () => {
            spawnProcess.kill('SIGINT')
        },
        result: async (): Promise<string> => {
            if (end) {
                return stdoutList.join('') + stderrList.join('')
            }
            return new Promise((resolve, reject) => {
                spawnProcess.on('close', (code) => {
                    if (code === 0 || code === null) {
                        resolve(stdoutList.join('') + stderrList.join(''))
                    } else {
                        reject(`command ${command} failed with code ${code}`)
                    }
                })
                spawnProcess.on('error', (err) => {
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
