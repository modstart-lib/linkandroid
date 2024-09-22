import util from "node:util";
import {exec as _exec, spawn} from "node:child_process";

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
} | null = null) => {
    option = option || {} as any
    let args = command.split(' ')
    const commandEntry = args.shift() as string
    // console.log('spawnShell', commandEntry, args, process.env)
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
        // console.log('spawnShell.stdout', stringData)
        stdoutList.push(stringData)
        option.stdout?.(stringData, spawnProcess)
    })
    // spawnProcess.stderr.setEncoding('utf8');
    spawnProcess.stderr?.on('data', (data) => {
        const stringData = data.toString()
        // console.log('spawnShell.stderr', stringData)
        stderrList.push(stringData)
        option.stderr?.(stringData, spawnProcess)
    })
    // spawnProcess.on('message', (message) => {
    //     console.log(`Fork process say`, message);
    // });
    // spawnProcess.on('spawn', (message) => {
    //     console.log(`Fork process spawn`, message);
    // })
    spawnProcess.on('close', (code) => {
        // console.log('spawnShell.close', code)
        if (code === 0 || code === null) {
            option.success?.(code)
        } else {
            option.error?.(`command ${command} failed with code ${code}`, code)
        }
        end = true
    })
    spawnProcess.on('error', (err) => {
        console.log('spawnShell.error', err)
        option.error?.(err)
        end = true
    })
    return {
        stop: () => {
            spawnProcess.kill('SIGINT')
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
