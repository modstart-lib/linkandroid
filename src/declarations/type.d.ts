declare interface Window {
    __page: {
        onShow: (cb: Function) => void,
        onHide: (cb: Function) => void,
        onMaximize: (cb: Function) => void,
        onUnmaximize: (cb: Function) => void,
        onEnterFullScreen: (cb: Function) => void,
        onLeaveFullScreen: (cb: Function) => void,
        onBroadcast: (type: string, cb: (data: any) => void) => void,
        offBroadcast: (type: string, cb: (data: any) => void) => void,
        registerCallPage: (
            name: string,
            cb: (
                resolve: (data: any) => void,
                reject: (error: string) => void,
                data: any
            ) => void
        ) => void,
        createChannel: (cb: (data: any) => void) => string,
        destroyChannel: (channel: string) => void,
    },
    $mapi: {
        app: {
            getPreload: () => Promise<string>,
            resourcePathResolve: (filePath: string) => Promise<string>,
            extraPathResolve: (filePath: string) => Promise<string>,
            platformName: () => 'win' | 'osx' | 'linux' | null,
            platformArch: () => 'x86' | 'arm64' | null,
            isPlatform: (platform: 'win' | 'osx' | 'linux') => boolean,
            quit: () => Promise<void>,
            restart: () => Promise<void>,
            windowMin: (name?: string) => Promise<void>,
            windowMax: (name?: string) => Promise<void>,
            windowSetSize: (name: string | null, width: number, height: number, option?: {
                includeMinimumSize: boolean,
                center: boolean
            }) => Promise<void>,
            windowOpen: (name: string, option?: any) => Promise<void>,
            windowHide: (name?: string) => Promise<void>,
            windowClose: (name?: string) => Promise<void>,
            openExternalWeb: (url: string) => Promise<void>,
            appEnv: () => Promise<any>,
            isDarkMode: () => Promise<boolean>,
            shell: (command: string, option?: {
                cwd?: string,
                outputEncoding?: string,
            }) => Promise<void>,
            spawnShell: (command: string | string[], option: {
                stdout?: (data: string, process: any) => void,
                stderr?: (data: string, process: any) => void,
                success?: (process: any) => void,
                error?: (msg: string, exitCode: number, process: any) => void,
                cwd?: string,
                outputEncoding?: string,
                env?: Record<string, any>,
            } | null) => Promise<{
                stop: () => void,
                send: (data: any) => void,
                result: () => Promise<string>
            }>,
            availablePort: (start: number, lockKey?: string, lockTime?: number) => Promise<number>,
            fixExecutable: (executable: string) => Promise<void>,
            getClipboardText: () => Promise<string>,
            setClipboardText: (text: string) => Promise<void>,
            getClipboardImage: () => Promise<string>,
            setClipboardImage: (image: string) => Promise<void>,
            getUserAgent: () => string,
            toast: (msg: string, option?: {
                duration?: number,
                status?: 'success' | 'error'
            }) => Promise<void>,
            setupList: () => Promise<{
                name: string,
                title: string,
                status: 'success' | 'fail',
                desc: string,
                steps: {
                    title: string,
                    image: string,
                }[]
            }[]>,
            setupOpen: (name: string) => Promise<void>,
        },
        config: {
            get: (key: string, defaultValue: any = null) => Promise<any>,
            set: (key: string, value: any) => Promise<void>,
            all: () => Promise<any>,
        },
        log: {
            root: () => string,
            info: (msg: string, data: any = null) => Promise<void>,
            error: (msg: string, data: any = null) => Promise<void>,
        },
        storage: {
            all: () => Promise<any>,
            get: (group: string, key: string, defaultValue: any) => Promise<any>,
            set: (group: string, key: string, value: any) => Promise<void>,
        },
        db: {
            execute: (sql: string, params: any = []) => Promise<any>,
            insert: (sql: string, params: any = []) => Promise<any>,
            first: (sql: string, params: any = []) => Promise<any>,
            select: (sql: string, params: any = []) => Promise<any>,
            update: (sql: string, params: any = []) => Promise<any>,
            delete: (sql: string, params: any = []) => Promise<any>,
        },
        file: {
            fullPath: (path: string) => Promise<string>,
            absolutePath: (path: string) => string,
            exists: (path: string, option?: { isFullPath?: boolean, }) => Promise<boolean>,
            isDirectory: (path: string, option?: { isFullPath?: boolean, }) => Promise<boolean>,
            mkdir: (path: string, option?: { isFullPath?: boolean, }) => Promise<void>,
            list: (path: string, option?: { isFullPath?: boolean, }) => Promise<any[]>,
            listAll: (path: string, option?: { isFullPath?: boolean, }) => Promise<any[]>,
            write: (path: string, data: any, option?: { isFullPath?: boolean, }) => Promise<void>,
            writeBuffer: (path: string, data: any, option?: { isFullPath?: boolean, }) => Promise<void>,
            read: (path: string, option?: { isFullPath?: boolean, }) => Promise<any>,
            readBuffer: (path: string, option?: { isFullPath?: boolean, }) => Promise<any>,
            deletes: (path: string, option?: { isFullPath?: boolean, }) => Promise<void>,
            rename: (pathOld: string, pathNew: string, option?: {
                isFullPath?: boolean,
                overwrite?: boolean
            }) => Promise<void>,
            copy: (pathOld: string, pathNew: string, option?: { isFullPath?: boolean, }) => Promise<void>,
            temp: (ext: string = 'tmp', prefix: string = 'file') => Promise<string>,
            tempDir: (prefix: string = 'dir') => Promise<string>,
            watchText: (path: string, callback: (data: {}) => void, option?: {
                isFullPath?: boolean,
                limit?: number,
            }) => Promise<{
                stop: Function,
            }>,
            appendText: (path: string, data: any, option?: { isFullPath?: boolean, }) => Promise<void>,
            openFile: (options: {} = {}) => Promise<any>,
            openDirectory: (options: {} = {}) => Promise<any>,
            openSave: (options: {} = {}) => Promise<any>,
            openPath: (path: string, options: {} = {}) => Promise<void>,
        },
        updater: {
            checkForUpdate: () => Promise<ApiResult<any>>,
        },
        statistics: {
            tick: (name: string, data: any = null) => Promise<void>,
        },
        lang: {
            writeSourceKey: (key: string) => Promise<void>,
            writeSourceKeyUse: (key: string) => Promise<void>,
        },
        event: {
            send: (name: string, type: string, data: any) => void,
            callPage: (name: string, type: string, data?: any, option?: any) => Promise<ApiResult<any>>,
            channelSend: (channel: string, data: any) => Promise<void>,
        },
        page: {
            open: (name: string, option?: any) => Promise<void>,
        },
        user: {
            open: (option?: any) => Promise<void>,
            get: () => Promise<{
                apiToken: string,
                user: {
                    id: string,
                    name: string,
                    avatar: string,
                },
                data: {},
                basic: {},
            }>,
            refresh: () => Promise<void>,
            getApiToken: () => Promise<string>,
            getWebEnterUrl: (url: string) => Promise<string>,
            openWebUrl: (url: string) => Promise<void>,
            apiPost: (url: string, data?: any) => Promise<any>,
        },
        misc: {
            getZipFileContent: (path: string, pathInZip: string) => Promise<string>,
            unzip: (zipPath: string, dest: string, option?: { process: Function }) => Promise<void>,
        },

        adb: {
            getBinPath: () => Promise<string>,
            setBinPath: (binPath: string) => Promise<boolean>,
            adbShell: (command: string, deviceId?: string) => Promise<string>,
            adbSpawnShell: (command: string, option?: {
                stdout?: Function | null,
                stderr?: Function | null,
                success?: Function | null,
                error?: Function | null,
            }, deviceId?: string) => Promise<string>,
            devices: () => Promise<any>,
            screencap: (serial: string) => Promise<string>,
            screenrecord: (serial: string, option?: {
                progress: (type: 'error' | 'success' | 'stdout' | 'stderr', data: any) => void
            }) => Promise<{
                stop: Function | null,
                devicePath: string,
            }>,
            watch: (callback: (type: string, data: any) => void) => Promise<void>,
            fileList: (serial: string, filePath: string) => Promise<any>,
            filePush: (serial: string, localPath: string, devicePath: string, options?: {
                progress: Function | null
            }) => Promise<void>,
            filePull: (serial: string, devicePath: string, localPath: string, options?: {
                progress: Function | null
            }) => Promise<any>,
            fileDelete: (serial: string, devicePath: string) => Promise<void>,
            install: (serial: string, localPath: string) => Promise<void>,
            uninstall: (serial: string, packageName: string) => Promise<void>,
            listApps: (serial: string) => Promise<any[]>,
            connect: (host: string, port: number) => Promise<void>,
            disconnect: (host: string, port: number) => Promise<void>,
            getDeviceIP: (serial: string) => Promise<string>,
            tcpip: (serial: string, port: number) => Promise<number>,
            usb: (serial: string) => Promise<void>,
            info: (serial: string) => Promise<{
                version: number,
            }>,
        },
        scrcpy: {
            getBinPath: () => Promise<string>,
            setBinPath: (binPath: string) => Promise<boolean>,
            shell: (command: string) => Promise<string>,
            spawnShell: (command: string, option?: {
                stdout?: Function | null,
                stderr?: Function | null,
                success?: Function | null,
                error?: Function | null,
            }) => Promise<any>,
            mirror: (serial: string, option: {
                title?: string,
                args?: string,
                stdout?: Function,
                stderr?: Function,
                success?: Function,
                error?: Function,
            }) => Promise<any>,
        },
        ffmpeg: {
            version: () => Promise<string>,
            run: (args: string[]) => Promise<string>,
        },
        server: {
            start: (serverInfo: ServerInfo) => Promise<void>,
            ping: (serverInfo: ServerInfo) => Promise<boolean>,
            stop: (serverInfo: ServerInfo) => Promise<void>,
            config: (serverInfo: ServerInfo) => Promise<any>,
            callFunction: (serverInfo: ServerInfo, method: string, data: any) => Promise<any>,
        },
    }
}


