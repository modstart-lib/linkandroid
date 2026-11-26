// Task code validation and fallback, moved from the old in-renderer agent loop.
// Kept dependency-free so both the worker and tests can import it.
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

const executableTaskCode = (code: string) =>
    code
        .split(/\r?\n/)
        .filter((line) => !line.trim().startsWith('#'))
        .join('\n')

export const validateGeneratedTaskCode = (code: string) => {
    const errors: string[] = []
    const executableCode = executableTaskCode(code)
    const significantLines = code
        .trim()
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'))
    if (significantLines[0] !== 'import la') {
        errors.push('代码必须以 import la 开头')
    }
    if (significantLines[1] !== 'device = la.device()') {
        errors.push('import la 后必须紧接 device = la.device()')
    }
    if (
        [
            /import\s+linkandroid/,
            /\b(?:la|device)\.print\s*\(/,
            /\b(?:adb|subprocess|os\.system|phone_screen|webdriver|Appium|Playwright)\b/i,
            /\b(?:driver|find_element|get_screen_size)\s*\(/,
            /\b(?:device|la)\.(?:get_screen_size|find_element)\s*\(/,
        ].some((pattern) => pattern.test(executableCode))
    ) {
        errors.push('代码包含不可用或禁止的 API')
    }
    if (
        ![
            /\b(?:device|la)\.(?:home|back|menu|recent|power|press|screenOn|screenOff|unlock)\s*\(/,
            /\b(?:device|la)\.(?:click|tap|doubleClick|longClick|swipe|swipeExt|swipeTo|drag)\s*\(/,
            /\b(?:device|la)\.(?:tapText|tapDesc|tapId|tapExists|clickText|clickIfExists)\s*\(/,
            /\b(?:device|la)\.(?:appStart|appStop|inputText|text|clearText|sendKeys)\s*\(/,
        ].some((pattern) => pattern.test(executableCode))
    ) {
        errors.push('代码必须包含至少一个真实手机控制动作')
    }
    if (
        /\bre\.(?:findall|finditer|search|match|sub|compile|split)\s*\(/.test(executableCode) &&
        !/^\s*import\s+re\b/m.test(executableCode)
    ) {
        errors.push('使用 re 正则时必须先 import re')
    }
    return errors
}

export const validateTaskCodeByRequirement = (code: string, requirement: string) => {
    const errors = validateGeneratedTaskCode(code)
    const executableCode = executableTaskCode(code)
    const countMatches = (patterns: RegExp[]) => patterns.filter((pattern) => pattern.test(executableCode)).length
    const isDiagnoseRequirement = /体检|品牌|型号|系统版本|内存/.test(requirement)
    const isStoreRequirement = /应用商店|应用市场|商店/.test(requirement)
    if (/回首页|回到首页|回桌面|回到桌面|返回首页|返回桌面/.test(requirement)) {
        if (!/\b(?:device|la)\.home\s*\(/.test(executableCode)) {
            errors.push('涉及回首页/回桌面时必须调用 device.home()')
        }
    }
    if (/列出|显示|获取|枚举/.test(requirement) && /图标|按钮|文字|当前界面|首页/.test(requirement)) {
        if (!/\b(?:device|la)\.(?:dumpHierarchy|findAll)\s*\(/.test(executableCode)) {
            errors.push('涉及当前界面图标/按钮/文字时，必须动态读取界面')
        }
    }
    if (!isStoreRequirement && /应用列表|所有应用|appList|应用清单|有哪些应用|手机里.*应用/.test(requirement)) {
        if (!/\b(?:device|la)\.appList\s*\(/.test(executableCode)) {
            errors.push('涉及手机应用清单时必须调用 device.appList()')
        }
        if (!/print\s*\([^)]*["'](?:app_count|app_pkg)=/.test(executableCode)) {
            errors.push('涉及手机应用清单时必须打印应用数量或应用包名')
        }
    }
    if (/设置/.test(requirement) && /打开|点击|找到|尝试/.test(requirement)) {
        if (
            !/\b(?:device|la)\.(?:tapText|tapExists|clickIfExists|exists|find|dumpHierarchy|appStart)\s*\(/.test(
                executableCode,
            )
        ) {
            errors.push('涉及查找或打开“设置”时必须读取界面或执行真实点击')
        }
    }
    if (!isDiagnoseRequirement && /序列号|屏幕尺寸|电量|当前应用|设备状态/.test(requirement)) {
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
    if (isDiagnoseRequirement) {
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
    if (/相册|图库|照片/.test(requirement)) {
        if (!/\b(?:device|la)\.(?:tapText|tapExists|appStart)\s*\(/.test(executableCode)) {
            errors.push('涉及打开相册时必须调用真实操作')
        }
        if (!/(相册|图库|照片|gallery|album)/i.test(executableCode)) {
            errors.push('涉及打开相册时，代码必须明确定位相册/图库/照片或 gallery/album 应用')
        }
    }
    if (isStoreRequirement) {
        if (!/\b(?:device|la)\.(?:dumpHierarchy|findAll)\s*\(/.test(executableCode)) {
            errors.push('应用商店任务必须打开后读取页面 XML 或控件内容')
        }
        if (!/\b(?:device|la)\.(?:tapText|tapExists|appStart)\s*\(/.test(executableCode)) {
            errors.push('应用商店任务必须包含打开商店的真实操作')
        }
    }
    if (/visible_nav_done/.test(requirement)) {
        if (!/\b(?:device|la)\.(?:recent|press)\s*\(/.test(executableCode)) {
            errors.push('明显导航动作任务必须包含打开最近任务的真实操作')
        }
        if (!/visible_nav_done=/.test(executableCode)) {
            errors.push('明显导航动作任务必须打印 visible_nav_done= 日志')
        }
    }
    if (/swipe_test_done/.test(requirement)) {
        if (!/\b(?:device|la)\.(?:swipe|swipeExt|swipeTo)\s*\(/.test(executableCode)) {
            errors.push('滑动测试任务必须包含真实滑动操作')
        }
        if (!/swipe_test_done=/.test(executableCode)) {
            errors.push('滑动测试任务必须打印 swipe_test_done= 日志')
        }
    }
    if (/settings_back_home_done/.test(requirement)) {
        if (!/\b(?:device|la)\.(?:tapText|tapExists|appStart)\s*\(/.test(executableCode)) {
            errors.push('设置页可见动作任务必须包含打开设置的真实操作')
        }
        if (!/settings_back_home_done=/.test(executableCode)) {
            errors.push('设置页可见动作任务必须打印 settings_back_home_done= 日志')
        }
    }
    return errors
}

export const buildRequirementFallbackTaskCode = (requirement: string) => {
    const hasGallery = /相册|图库|照片/.test(requirement)
    const hasStore = /应用商店|应用市场|商店/.test(requirement)
    const wantsIcons = /图标|按钮|文字|当前.*桌面|首页/.test(requirement)
    const wantsAppList = /应用清单|应用列表|有哪些应用|手机里.*应用/.test(requirement)
    const wantsDiagnose = /体检|品牌|型号|系统版本|内存/.test(requirement)
    const wantsDeviceInfo = /序列号|屏幕尺寸|电量|当前应用|设备状态/.test(requirement)
    const wantsVisibleNav = /最近任务|多任务|返回键|按返回|明显动作|看得到|肉眼/.test(requirement)
    const wantsSwipe = /滑动|上滑|下滑|左滑|右滑/.test(requirement)
    const wantsSettingsVisible = /打开设置|进入设置|设置页/.test(requirement)
    if (wantsVisibleNav) {
        return [
            'import la',
            'device = la.device()',
            'device.screenOn()',
            'device.home()',
            'print("visible_home_done=true")',
            'la.sleep(1)',
            'device.recent()',
            'print("visible_recent_done=true")',
            'la.sleep(1)',
            'device.back()',
            'print("visible_back_done=true")',
            'la.sleep(1)',
            'device.home()',
            'print("visible_nav_done=true")',
        ].join('\n')
    }
    if (wantsSwipe) {
        return [
            'import la',
            'device = la.device()',
            'device.screenOn()',
            'device.home()',
            'print("swipe_home_done=true")',
            'la.sleep(1)',
            'device.swipeExt("up")',
            'print("swipe_up_done=true")',
            'la.sleep(1)',
            'device.swipeExt("down")',
            'print("swipe_down_done=true")',
            'la.sleep(1)',
            'device.home()',
            'print("swipe_test_done=true")',
        ].join('\n')
    }
    if (wantsSettingsVisible) {
        return [
            'import la',
            'device = la.device()',
            'device.screenOn()',
            'device.home()',
            'print("settings_home_done=true")',
            'opened = device.tapText("设置", timeout=5)',
            'print("settings_opened=" + str(opened))',
            'la.sleep(2)',
            'print("settings_package=" + str(device.currentPackage()))',
            'device.home()',
            'print("settings_back_home_done=true")',
        ].join('\n')
    }
    if (hasStore) {
        return [
            'import la',
            'device = la.device()',
            'import re',
            'device.home()',
            'opened = False',
            'for name in ["应用商店", "应用市场", "商店", "应用商城"]:',
            '    if device.tapText(name, timeout=3):',
            '        print("store_opened=" + name)',
            '        opened = True',
            '        break',
            'if not opened:',
            '    print("store_opened=false")',
            '    print("store_reason=desktop icon not found by text: 应用商店/应用市场/商店/应用商城")',
            'la.sleep(2)',
            'xml = device.dumpHierarchy()',
            'texts = re.findall(r\'(?:text|content-desc)="([^"]+)"\', xml)',
            'for item in texts[:30]:',
            '    if item.strip():',
            '        print("store_text=" + item.strip())',
        ].join('\n')
    }
    if (hasGallery && wantsIcons) {
        return [
            'import la',
            'device = la.device()',
            'import re',
            'device.home()',
            'xml = device.dumpHierarchy()',
            'texts = re.findall(r\'(?:text|content-desc)="([^"]+)"\', xml)',
            'for item in texts:',
            '    if item.strip():',
            '        print("icon_text=" + item.strip())',
            'print("gallery_tap=" + str(device.tapText("相册", timeout=3)))',
        ].join('\n')
    }
    if (wantsDiagnose) {
        return [
            'import la',
            'device = la.device()',
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
            'device.home()',
            'apps = device.appList()',
            'print("app_count=" + str(len(apps)))',
            'for pkg in apps[:50]:',
            '    print("app_pkg=" + str(pkg))',
            hasGallery
                ? 'print("gallery_tap=" + str(device.tapText("相册", timeout=3)))'
                : 'print("settings_tap=" + str(device.tapText("设置", timeout=3)))',
        ].join('\n')
    }
    return ''
}
