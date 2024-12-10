import {Permissions} from "../../lib/permission";

export const SetupMain = {
    async list() {
        return [
            {
                name: 'accessibility',
                title: '辅助功能',
                status: (await Permissions.checkAccessibilityPermission()) ? 'success' : 'fail',
                desc: '系统运行需要依赖辅助功能，请打开设置，找到辅助功能，开启本软件的辅助功能。',
                steps: [
                    {
                        title: '打开设置，找到“隐私与安全性”，点击进入，开启FocusAny',
                        image: '/setup/accessibility.png'
                    },
                ]
            },
        ]
    },
    async open(name: string) {
        switch (name) {
            case 'accessibility':
                Permissions.askAccessibilityPermission().then()
                break
        }
    }
}
