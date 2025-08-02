import {Log} from "../log/main";

export const ProtocolMain = {
    isReady: false,
    ready() {
        this.isReady = true;
    },
    url: null,
    async queue(url: string) {
        this.url = url;
        await this.runProtocol();
    },
    async runProtocol() {
        return new Promise<any>(async resolve => {
            const run = async () => {
                if (!this.isReady) {
                    setTimeout(run, 100);
                    return;
                }
                if (!this.url) {
                    Log.info("ProtocolMain.runProtocol.url.Empty", this.filePath);
                    return;
                }
                const url = this.url;
                const urlInfo = new URL(url);
                const command = urlInfo.hostname;
                const param = urlInfo.searchParams;
                Log.info("ProtocolMain.runProtocol", {command, param, url, urlInfo});
                if (!command) {
                    Log.info("ProtocolMain.runProtocol.command.Empty", url);
                    return;
                }
                if (!this.commandListeners[command]) {
                    Log.info("ProtocolMain.runProtocol.command.NotFound", command);
                    return;
                }
                for (const callback of this.commandListeners[command]) {
                    callback(Object.fromEntries(param.entries()));
                }
                resolve(undefined);
            };
            run().then();
        });
    },
    commandListeners: {} as {
        [command: string]: Array<(params: {[key: string]: string}) => void>;
    },
    register(command: string, callback: (params: {[key: string]: string}) => void) {
        if (!this.commandListeners[command]) {
            this.commandListeners[command] = [];
        }
        this.commandListeners[command].push(callback);
    },
    unregister(command: string, callback: (params: {[key: string]: string}) => void) {
        if (!this.commandListeners[command]) {
            return;
        }
        const index = this.commandListeners[command].indexOf(callback);
        if (index >= 0) {
            this.commandListeners[command].splice(index, 1);
        }
    },
};

export default ProtocolMain;
