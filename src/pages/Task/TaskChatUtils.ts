export const pythonString = (value: string) => {
    return value.replace(/\\/g, '\\\\').replace(/'''/g, "\\'\\'\\'")
}

export const normalizeGeneratedTaskCode = (code: string) => {
    let value = (code || '').trim()
    const blockMatch = value.match(/```(?:python)?\s*([\s\S]*?)```/i)
    if (blockMatch) {
        value = blockMatch[1].trim()
    }
    value = value.replace(/^\s*#!.*\n/, '').trim()
    const lines = value.split(/\r?\n/)
    const firstImportIndex = lines.findIndex((line) => line.trim() === 'import la')
    if (firstImportIndex > 0) {
        value = lines.slice(firstImportIndex).join('\n').trim()
    }
    return value
}

export const validateGeneratedTaskCode = (code: string) => {
    const errors: string[] = []
    const trimmed = code.trim()
    const significantLines = trimmed
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'))
    if (significantLines[0] !== 'import la') {
        errors.push('代码必须以 import la 开头')
    }
    if (significantLines[1] !== 'device = la.device()') {
        errors.push('import la 后必须紧接 device = la.device()')
    }
    const forbiddenPatterns = [
        /import\s+linkandroid/,
        /\b(?:la|device)\.print\s*\(/,
        /\b(?:adb|subprocess|os\.system|phone_screen|webdriver|Appium|Playwright)\b/i,
        /\b(?:driver|find_element)\s*\(/,
    ]
    if (forbiddenPatterns.some((pattern) => pattern.test(code))) {
        errors.push('代码包含不可用或禁止的 API')
    }
    const controlPatterns = [
        /\b(?:device|la)\.(?:home|back|menu|recent|power|press|screenOn|screenOff|unlock)\s*\(/,
        /\b(?:device|la)\.(?:click|tap|doubleClick|longClick|swipe|swipeExt|swipeTo|drag)\s*\(/,
        /\b(?:device|la)\.(?:tapText|tapDesc|tapId|tapExists|clickText|clickIfExists)\s*\(/,
        /\b(?:device|la)\.(?:appStart|appStop|inputText|text|clearText|sendKeys)\s*\(/,
    ]
    if (!controlPatterns.some((pattern) => pattern.test(code))) {
        errors.push('代码必须包含至少一个真实手机控制动作，例如 device.home()、device.tapText() 或 device.appStart()')
    }
    return errors
}

export const validateTaskCodeByRequirement = (code: string, requirement: string) => {
    const errors = validateGeneratedTaskCode(code)
    const countMatches = (patterns: RegExp[]) => patterns.filter((pattern) => pattern.test(code)).length
    if (/列出|显示|获取|枚举/.test(requirement) && /图标|按钮|文字|当前界面|首页/.test(requirement)) {
        if (!/\b(?:device|la)\.(?:dumpHierarchy|findAll)\s*\(/.test(code)) {
            errors.push('涉及当前界面图标/按钮/文字时，必须用 device.dumpHierarchy() 或 device.findAll() 动态读取界面')
        }
    }
    if (/应用列表|所有应用|appList/.test(requirement) && !/\b(?:device|la)\.appList\s*\(/.test(code)) {
        errors.push('涉及应用列表时必须调用 device.appList() 或 la.appList()')
    }
    if (/应用清单|应用列表|有哪些应用|手机里.*应用/.test(requirement) && !/\b(?:device|la)\.appList\s*\(/.test(code)) {
        errors.push('涉及手机应用清单时必须调用 device.appList()')
    }
    if (/序列号|屏幕尺寸|电量|当前应用|设备状态/.test(requirement)) {
        const infoCount = countMatches([
            /\b(?:device|la)\.serial\s*\(/,
            /\b(?:device|la)\.width\s*\(/,
            /\b(?:device|la)\.height\s*\(/,
            /\b(?:device|la)\.battery\s*\(/,
            /\b(?:device|la)\.appCurrent\s*\(/,
            /\b(?:device|la)\.currentPackage\s*\(/,
            /\b(?:device|la)\.currentActivity\s*\(/,
        ])
        if (infoCount < 4) {
            errors.push('设备状态任务必须读取序列号、屏幕尺寸、电量和当前应用等真实设备信息')
        }
    }
    if (/体检|品牌|型号|系统版本|内存/.test(requirement)) {
        const diagnoseCount = countMatches([
            /\b(?:device|la)\.deviceInfo\s*\(/,
            /\b(?:device|la)\.battery\s*\(/,
            /\b(?:device|la)\.memoryInfo\s*\(/,
            /\b(?:device|la)\.cpuInfo\s*\(/,
            /\b(?:device|la)\.serial\s*\(/,
            /\b(?:device|la)\.wlanIp\s*\(/,
        ])
        if (diagnoseCount < 3) {
            errors.push('设备体检任务必须读取 deviceInfo、battery、memoryInfo 等诊断信息')
        }
    }
    if (/相册|图库|照片/.test(requirement) && !/\b(?:device|la)\.(?:tapText|tapExists|appStart)\s*\(/.test(code)) {
        errors.push('涉及打开相册时必须调用 device.tapText/device.tapExists/device.appStart 等真实操作')
    }
    if (/相册|图库|照片/.test(requirement) && !/(相册|图库|照片|gallery|album)/i.test(code)) {
        errors.push('涉及打开相册时，代码必须明确定位相册/图库/照片或 gallery/album 应用')
    }
    if (/应用商店|应用市场|商店/.test(requirement)) {
        if (!/\b(?:device|la)\.(?:dumpHierarchy|findAll)\s*\(/.test(code)) {
            errors.push('应用商店任务必须打开后读取页面 XML 或控件内容')
        }
        if (!/\b(?:device|la)\.(?:tapText|tapExists|appStart)\s*\(/.test(code)) {
            errors.push('应用商店任务必须包含打开商店的真实操作')
        }
    }
    return errors
}

export const buildRequirementFallbackTaskCode = (requirement: string) => {
    const text = requirement.trim()
    const hasGallery = /相册|图库|照片/.test(text)
    const hasStore = /应用商店|应用市场|商店/.test(text)
    const wantsIcons = /图标|按钮|文字|当前.*桌面|首页/.test(text)
    const wantsAppList = /应用清单|应用列表|有哪些应用|手机里.*应用/.test(text)
    const wantsDiagnose = /体检|品牌|型号|系统版本|内存/.test(text)
    const wantsDeviceInfo = /序列号|屏幕尺寸|电量|当前应用|设备状态/.test(text)
    if (hasStore) {
        return [
            'import la',
            'device = la.device()',
            'import re',
            '',
            'device.home()',
            'opened = False',
            'for name in ["应用商店", "应用市场", "商店", "应用商城"]:',
            '    try:',
            '        if device.tapText(name, timeout=3):',
            '            print("store_opened=" + name)',
            '            opened = True',
            '            break',
            '    except Exception as e:',
            '        print("store_tap_error=" + name + ":" + str(e))',
            'if not opened:',
            '    print("store_opened=false")',
            'la.sleep(2)',
            'xml = device.dumpHierarchy()',
            'texts = re.findall(r\'(?:text|content-desc)="([^"]+)"\', xml)',
            'for item in texts[:30]:',
            '    item = item.strip()',
            '    if item:',
            '        print("store_text=" + item)',
        ].join('\n')
    }
    if (hasGallery && wantsIcons) {
        return [
            'import la',
            'device = la.device()',
            'import re',
            '',
            'device.home()',
            'xml = device.dumpHierarchy()',
            'texts = re.findall(r\'(?:text|content-desc)="([^"]+)"\', xml)',
            'for item in texts:',
            '    item = item.strip()',
            '    if item:',
            '        print("icon_text=" + item)',
            'try:',
            '    print("gallery_tap=" + str(device.tapText("相册", timeout=3)))',
            'except Exception as e:',
            '    print("gallery_tap_error=" + str(e))',
        ].join('\n')
    }
    if (wantsDiagnose) {
        return [
            'import la',
            'device = la.device()',
            '',
            'device.home()',
            'info = device.deviceInfo()',
            'print("brand=" + str(info.get("brand", "")))',
            'print("model=" + str(info.get("model", "")))',
            'print("android_version=" + str(info.get("version", info.get("android_version", ""))))',
            'battery = device.battery()',
            'print("battery_level=" + str(battery.get("level", "")))',
            'memory = device.memoryInfo()',
            'print("memory_total=" + str(memory.get("total", "")))',
            'print("serial=" + str(device.serial()))',
        ].join('\n')
    }
    if (wantsDeviceInfo) {
        return [
            'import la',
            'device = la.device()',
            '',
            'device.home()',
            'print("serial=" + str(device.serial()))',
            'print("width=" + str(device.width()))',
            'print("height=" + str(device.height()))',
            'battery = device.battery()',
            'print("battery_level=" + str(battery.get("level", "")))',
            'current = device.appCurrent()',
            'print("currentPackage=" + str(current.get("package", "")))',
            'print("currentActivity=" + str(current.get("activity", "")))',
        ].join('\n')
    }
    if (hasGallery || wantsAppList) {
        return [
            'import la',
            'device = la.device()',
            '',
            'device.home()',
            'apps = device.appList()',
            'print("app_count=" + str(len(apps)))',
            'for pkg in apps[:50]:',
            '    print("app_pkg=" + str(pkg))',
            ...(hasGallery
                ? [
                      'try:',
                      '    print("gallery_tap=" + str(device.tapText("相册", timeout=3)))',
                      'except Exception as e:',
                      '    print("gallery_tap_error=" + str(e))',
                  ]
                : [
                      'try:',
                      '    print("settings_tap=" + str(device.tapText("设置", timeout=3)))',
                      'except Exception as e:',
                      '    print("settings_tap_error=" + str(e))',
                  ]),
        ].join('\n')
    }
    return ''
}

export const extractTargetsFromXml = (xml: string, keyword = '', maxItems = 30) => {
    const documentXml = new DOMParser().parseFromString(xml, 'text/xml')
    const nodes = Array.from(documentXml.querySelectorAll('*'))
    const target = keyword.trim().toLowerCase()
    return nodes
        .map((el) => {
            const bounds = el.getAttribute('bounds') || ''
            const match = bounds.match(/\[(\d+),(\d+)]\[(\d+),(\d+)]/)
            if (!match) return null
            const text = el.getAttribute('text') || ''
            const contentDesc = el.getAttribute('content-desc') || ''
            const resourceId = el.getAttribute('resource-id') || ''
            const className = el.getAttribute('class') || ''
            const clickable = el.getAttribute('clickable') || ''
            const haystack = `${text} ${contentDesc} ${resourceId}`.toLowerCase()
            if (target && !haystack.includes(target)) return null
            if (!text && !contentDesc && !resourceId) return null
            const x1 = Number(match[1])
            const y1 = Number(match[2])
            const x2 = Number(match[3])
            const y2 = Number(match[4])
            return {
                text,
                contentDesc,
                resourceId,
                className,
                clickable,
                bounds,
                centerX: Math.floor((x1 + x2) / 2),
                centerY: Math.floor((y1 + y2) / 2),
            }
        })
        .filter(Boolean)
        .slice(0, Math.max(1, Math.min(Number(maxItems) || 30, 80)))
}

export const formatUiTargets = (targets: any[]) => {
    if (targets.length === 0) {
        return '无匹配控件'
    }
    return targets
        .map((item, index) => {
            return [
                `${index + 1}.`,
                item.text ? `text="${item.text}"` : '',
                item.contentDesc ? `desc="${item.contentDesc}"` : '',
                item.resourceId ? `id="${item.resourceId}"` : '',
                item.className ? `class="${item.className}"` : '',
                item.clickable ? `clickable=${item.clickable}` : '',
                item.bounds ? `bounds=${item.bounds}` : '',
                `center=(${item.centerX},${item.centerY})`,
            ]
                .filter(Boolean)
                .join(' ')
        })
        .join('\n')
}
