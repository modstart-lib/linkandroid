import {Permissions} from "../../lib/permission";

export const SetupMain = {
    async list() {
        return [
            {
                name: 'accessibility',
                title: '辅助功能',
                status: (await Permissions.checkAccessibilityAccess()) ? 'success' : 'fail',
                desc: '系统运行需要依赖辅助功能，请打开设置，找到辅助功能，开启本软件的辅助功能。',
                steps: [
                    {
                        title: '打开 设置 → 隐私与安全性 → 辅助功能，开启本软件',
                        image: '/setup/accessibility.png'
                    },
                ]
            },
            {
                name: 'screen',
                title: '屏幕录制',
                status: (await Permissions.checkScreenCaptureAccess()) ? 'success' : 'fail',
                desc: '系统运行需要依赖屏幕录制，请打开设置，找到屏幕录制，开启本软件的屏幕录制权限。',
                steps: [
                    {
                        title: '打开 设置 → 隐私与安全性 → 录屏与系统录音，开启本软件',
                        image: '/setup/screen.png'
                    },
                ]
            }
        ]
    },
    async open(name: string) {
        switch (name) {
            case 'accessibility':
                Permissions.askAccessibilityAccess().then()
                break
            case 'screen':
                Permissions.askScreenCaptureAccess().then()
                break
        }
    }
}
