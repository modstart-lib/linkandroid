interface ServerInfo {
    localPath: string,
    name: string,
    version: string,
    setting: {
        [key: string]: any,
    },
    logFile: string,
}
