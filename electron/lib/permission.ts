import {isMac} from "./env";
import nodeMacPermissions from 'node-mac-permissions';

export const Permissions = {
    async checkAccessibilityPermission(): Promise<boolean> {
        return new Promise((resolve, reject) => {
            if (isMac) {
                const status = nodeMacPermissions.getAuthStatus('accessibility');
                resolve(status === 'authorized')
            } else {
                resolve(true);
            }
        })
    },
    async askAccessibilityPermission() {
        nodeMacPermissions.askForAccessibilityAccess()
    }
}
