declare interface Window {
    $mapi: {
        app: {
            resourcePathResolve: (filePath: string) => Promise<string>,
            extraPathResolve: (filePath: string) => Promise<string>,
            platform: () => string,
            quit: () => Promise<void>,
            windowMin: () => Promise<void>,
            windowMax: () => Promise<void>,
            windowSetSize: (width: number, height: number) => Promise<void>,
        },
        config: {
            get: (key: string, defaultValue: any = null) => Promise<any>,
            set: (key: string, value: any) => Promise<void>,
            all: () => Promise<any>,
        },
        log: {
            info: (msg: string, data: any = null) => Promise<void>,
            error: (msg: string, data: any = null) => Promise<void>,
        },
        storage: {
            all: () => Promise<any>,
            get: (group: string, key: string, defaultValue: any) => Promise<any>,
            set: (group: string, key: string, value: any) => Promise<void>,
        },
        file: {
            absolutePath: (path: string) => string,
            exists: (path: string) => Promise<boolean>,
            isDirectory: (path: string) => Promise<boolean>,
            mkdir: (path: string) => Promise<void>,
            list: (path: string) => Promise<any[]>,
            listAll: (path: string) => Promise<any[]>,
            write: (path: string, data: any) => Promise<void>,
            read: (path: string) => Promise<any>,
            deletes: (path: string) => Promise<void>,
            rename: (pathOld: string, pathNew: string) => Promise<void>,
            openFile: (options: {} = {}) => Promise<any>,
        },
        updater: {
            checkForUpdate: (callback: (type: 'error' | 'checking' | 'available' | 'notAvailable', data: any) => void) => Promise<void>,
            downloadUpdate: (callback: (type: 'error' | 'progress' | 'downloaded', data: any) => void) => Promise<void>,
            quitAndInstall: () => Promise<void>,
        },
        statistics: {
            tick: (name: string, data: any = null) => Promise<void>,
        },
        adb: {
            getBinPath: () => Promise<string>,
            setBinPath: (binPath: string) => Promise<boolean>,
            devices: () => Promise<any>,
            screencap: (serial: string) => Promise<string>,
            watch: (callback: (type: string, data: any) => void) => Promise<void>,
            fileList: (serial: string, filePath: string) => Promise<any>,
            filePush: (serial: string, localPath: string, devicePath: string, options: {
                progress: Function | null
            }) => Promise<void>,
            filePull: (serial: string, devicePath: string, localPath: string, options: {
                progress: Function | null
            }) => Promise<void>,
            fileDelete: (serial: string, devicePath: string) => Promise<void>,
        },
        scrcpy: {
            getBinPath: () => Promise<string>,
            setBinPath: (binPath: string) => Promise<boolean>,
            mirror: (serial: string, options: {
                title: string,
                args: string,
                exec: boolean,
                option: { stdout: Function, stderr: Function }
            }) => Promise<void>,
        }
    }
}


