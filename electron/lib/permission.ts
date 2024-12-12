import {isMac} from "./env";

let nodeMacPermissions = null
if (isMac) {
    (async () => {
        try {
            nodeMacPermissions = await import('node-mac-permissions');
            nodeMacPermissions = nodeMacPermissions.default;
            // console.log('nodeMacPermissions',nodeMacPermissions);
        } catch (e) {
        }
    })()
}

export const Permissions = {
    async checkAccessibilityAccess(): Promise<boolean> {
        return new Promise((resolve, reject) => {
            if (isMac) {
                const status = nodeMacPermissions.getAuthStatus('accessibility');
                resolve(status === 'authorized')
            } else {
                resolve(true);
            }
        })
    },
    async askAccessibilityAccess() {
        nodeMacPermissions.askForAccessibilityAccess()
    },
    async checkScreenCaptureAccess(): Promise<boolean> {
        return new Promise((resolve, reject) => {
            if (isMac) {
                const status = nodeMacPermissions.getAuthStatus('screen');
                resolve(status === 'authorized')
            } else {
                resolve(true);
            }
        })
    },
    async askScreenCaptureAccess() {
        nodeMacPermissions.askForScreenCaptureAccess(true)
    },
}
