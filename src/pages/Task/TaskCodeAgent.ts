export type TaskCodeAgentResult = {
    ok: boolean
    code?: string
    message: string
    requestId?: string
    ask?: {
        question: string
        options?: string[]
    }
}

type ChatModel = (providerId: string, modelId: string, input: string, options: any, runtimeOptions: any) => Promise<any>

export type TaskCodeAgentOptions = {
    providerId: string
    modelId: string
    requirement: string
    currentCode: string
    deviceBasicInfo: string
    xmlInfo: string
    screenshot: string
    selectedDeviceId: string
    chat: ChatModel
    collectXml: (deviceId: string) => Promise<string>
    collectScreenshot: (deviceId: string) => Promise<string>
    runPython: (code: string, deviceId: string) => Promise<{result: () => Promise<string>}>
    updateReadyMessage: string
}

type UiTarget = {
    text: string
    contentDesc: string
    resourceId: string
    className: string
    clickable: string
    bounds: string
    centerX: number
    centerY: number
}

const LINKANDROID_TASK_API_PROMPT = [
    '===== 运行环境 =====',
    '- Python 任务必须只使用 import la 和 la 库能力。',
    '- 代码必须以 import la 开头，紧接着写 device = la.device()。',
    '- 默认单设备任务优先使用 device.xxx()；不要默认使用多设备，除非用户明确要求。',
    '- 禁止使用 adb、subprocess、os.system、phone_screen、Selenium、Appium、Playwright。',
    '- 输出只能使用 Python 内置 print()，禁止 la.print()、device.print()。',
    '',
    '===== 入口与连接 =====',
    'la.connect(addr=None, serial=None) -> Device：连接设备。',
    'la.device() -> Device：获取默认设备代理，任务代码必须写 device = la.device()。',
    'la.devices() -> list[Device]：获取所有已连接设备。',
    'la.raw() / device.raw() -> uiautomator2.Device：获取原生 uiautomator2 对象，仅在封装 API 不够时使用。',
    'la.disconnect()：断开连接。',
    '',
    '===== 工具函数 =====',
    'la.sleep(seconds)：休眠秒数。',
    'la.util.sleep(seconds)：休眠秒数。',
    'la.util.now() -> str：当前 ISO 时间。',
    'la.util.jsonLoads(text) -> object：解析 JSON 字符串。',
    'la.util.jsonDumps(data) -> str：序列化 JSON。',
    'la.util.retry(callback, times=3, interval=1)：重试执行回调。',
    '',
    '===== HTTP =====',
    'la.http.get(url, **kwargs) -> response/json：GET 请求。',
    'la.http.post(url, **kwargs) -> response/json：POST 请求。',
    'la.http.request(method, url, **kwargs)：通用 HTTP 请求。',
    'la.http.json(method, url, **kwargs) -> dict：请求并解析 JSON。',
    '',
    '===== 坐标与滑动（device/long alias） =====',
    'device.click(x: int, y: int, timeout: float|None=None)：点击坐标。',
    'device.tap(x: int, y: int, timeout: float|None=None)：click 别名。',
    'device.doubleClick(x: int, y: int, duration: float=0.1)：双击。',
    'device.longClick(x: int, y: int, duration: float=0.5)：长按。',
    'device.swipe(fx: int, fy: int, tx: int, ty: int, duration: float=0.5)：从起点滑到终点。',
    'device.swipeExt(direction: str, scale: float=0.8)：按方向滑动，direction 只能是 up/down/left/right。',
    'device.swipeTo(direction: str, text: str|None=None, timeout: float=10) -> bool：滑动直到目标文字出现。',
    'device.drag(fx: int, fy: int, tx: int, ty: int, duration: float=0.5)：拖拽。',
    'device.scrollForward() / device.scrollBackward()：滚动。',
    '',
    '===== 文字输入 =====',
    'device.text(text: str, clear: bool=False, enter: bool=False)：输入文本；clear=True 先清空，enter=True 输入后回车。',
    'device.inputText(text: str, clear: bool=False, enter: bool=False)：输入文本。',
    'device.clearText()：清空输入框。',
    'device.sendKeys(text: str)：逐字符发送。',
    'device.typeText(text: str)：输入文本别名。',
    '',
    '===== 截图与 XML =====',
    'device.screenshot(filename: str|None=None, quality: int=90)：截图；filename 为空时返回图片数据。',
    'device.dumpHierarchy() -> str：获取当前界面 XML。',
    'device.dumpXmlToFile(path: str)：保存 XML 到文件。',
    '',
    '===== 元素选择与等待 =====',
    '选择器参数统一为：text、className、resourceId、description(content-desc)、packageName、index。',
    'device.selector(text=None, className=None, resourceId=None, description=None, packageName=None, index=None)：构造选择器。',
    'device.select(...)：selector 别名，参数同 selector。',
    'device.find(text=None, className=None, resourceId=None, description=None, packageName=None, index=None) -> UIElement|None：查找第一个元素。',
    'device.findAll(text=None, className=None, resourceId=None, description=None, packageName=None) -> list[UIElement]：查找所有元素。',
    'device.exists(text=None, className=None, resourceId=None, description=None, timeout=0) -> bool：判断元素是否存在。',
    'device.count(text=None, className=None, resourceId=None, description=None) -> int：统计匹配元素数量。',
    'device.wait(text=None, className=None, resourceId=None, description=None, timeout=10) -> bool：等待元素出现。',
    'device.findByXpath(xpath: str)：XPath 查找。',
    '',
    '===== 快捷点击 =====',
    'device.clickText(text: str, timeout: float=10)：按 text 点击。',
    'device.tapText(text: str, timeout: float=10)：按 text 点击，常用于点击桌面图标/按钮文字。',
    'device.tapDesc(description: str, timeout: float=10)：按 content-desc 点击。',
    'device.tapId(resourceId: str, timeout: float=10)：按 resource-id 点击。',
    'device.tapExists(timeout: float=3, **selector) -> bool：存在则点击；示例 device.tapExists(text="允许", timeout=3)。',
    'device.clickIfExists(timeout: float=3, **selector) -> bool：tapExists 别名。',
    '',
    '===== UIElement 操作 =====',
    'device.clickElement(element)：点击元素对象。',
    'device.clickCenter(element)：点击元素中心。',
    'device.getText(element) -> str：获取元素文本。',
    'device.getBounds(element) -> dict：获取元素边界 {left, top, right, bottom}。',
    'device.center(element) -> tuple：获取元素中心点 (x, y)。',
    'device.info(element) -> dict：获取元素 info 属性。',
    '',
    '===== 应用管理 =====',
    'device.appStart(package_name: str, activity: str|None=None)：启动应用；activity 可省略。',
    'device.appStop(package_name: str)：停止应用。',
    'device.appClear(package_name: str)：清除应用数据。',
    'device.appCurrent() -> dict：当前前台应用 {"package": str, "activity": str}。',
    'device.appList() -> list[str]：应用包名列表。',
    'device.appInstall(url_or_path: str)：安装 APK。',
    'device.appUninstall(package_name: str)：卸载应用。',
    'device.currentPackage() -> str：当前前台包名。',
    'device.currentActivity() -> str：当前前台 Activity。',
    '',
    '===== 按键 =====',
    'device.press(key: str)：按键，key 可为 home/back/enter/delete/search/volume_up 等。',
    'device.home() / device.back() / device.menu() / device.recent() / device.power()。',
    'device.pressHome() / device.pressBack() / device.pressMenu() / device.pressRecent() / device.pressPower()。',
    'device.pressEnter() / device.pressDel()。',
    '',
    '===== 屏幕与设备信息 =====',
    'device.width() -> int：屏幕宽度。',
    'device.height() -> int：屏幕高度。',
    'device.size() -> tuple：屏幕尺寸 (width, height)。',
    'device.isScreenOn() -> bool：屏幕是否亮。',
    'device.screenOn()：点亮屏幕。',
    'device.screenOff()：熄灭屏幕。',
    'device.unlock()：滑动解锁。',
    'device.deviceInfo() -> dict：品牌、型号、Android 版本等完整设备信息。',
    'device.serial() -> str：设备序列号。',
    'device.wlanIp() -> str：WLAN IP。',
    'device.battery() -> dict：电池信息，含 level、temperature、status 等字段。',
    'device.memoryInfo() -> dict：内存信息，含 total、available 等字段。',
    'device.cpuInfo() -> dict：CPU 信息。',
    '',
    '===== 系统面板、剪贴板、录屏、URL =====',
    'device.openNotification()：打开通知栏。',
    'device.openQuickSettings()：打开快捷设置。',
    'device.setClipboard(text: str)：设置剪贴板。',
    'device.getClipboard() -> str：读取剪贴板。',
    'device.startScreenRecord(path: str)：开始录屏。',
    'device.stopScreenRecord()：停止录屏。',
    'device.openUrl(url: str)：用系统浏览器打开 URL。',
    'device.toast(message: str, duration: float=2)：显示 Toast。',
    'device.setFastInputIme(enable: bool=True)：开关快速输入法。',
    '',
    '===== 等待 =====',
    'device.waitIdle(timeout: float=10) -> bool：等待设备空闲。',
    'device.waitActivity(activity: str, timeout: float=10) -> bool：等待 Activity，支持正则。',
    'device.waitUntil(condition, timeout: float=10, interval: float=1) -> bool：等待自定义条件成立。',
    'device.waitUntilGone(text=None, className=None, resourceId=None, description=None, timeout: float=10) -> bool：等待元素消失。',
    'device.error：通用异常别名，可用于 except。',
    '',
    '===== 多设备 =====',
    'devices = la.devices()：获取多设备列表。',
    'la.multi.click(devices, x, y)：多设备点击。',
    'la.multi.back(devices)：多设备返回。',
    'for ds in devices: print(ds.serial()); ds.click(x, y)：遍历多设备。',
    '',
    '===== 需求到 API 的常见映射 =====',
    '- 设备基础信息：device.home(), serial(), width(), height(), battery(), appCurrent()',
    '- 手机体检/品牌/型号/系统版本/内存：device.home(), deviceInfo(), battery(), memoryInfo(), serial()',
    '- 应用清单/有哪些应用：device.home(), appList()，逐项 print 包名',
    '- 桌面图标/按钮/文字：device.home(), dumpHierarchy()，用 re 提取 text/content-desc 后 print',
    '- 打开相册/图库：优先 device.tapText("相册", timeout=3)，并打印 gallery_tap=',
    '- 打开应用商店：优先尝试 tapText("应用商店"/"应用市场")，打开后 dumpHierarchy() 并打印页面文字',
    '',
    '===== 常见错误 API（禁止使用） =====',
    '- 不存在 device.waitForElement()、device.getElementText()、device.getScreenSize()。',
    '- 不要导入 selenium.webdriver.common.by.By，不要写 By.XPATH。',
    '- 不要使用 driver、find_element、phone_screen、adb、subprocess、os.system。',
    '- 获取页面文字用 device.dumpHierarchy() 或 device.findAll()；点击文字用 device.tapText()。',
].join('\n')

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

const pythonString = (value: string) => value.replace(/\\/g, '\\\\').replace(/'''/g, "\\'\\'\\'")

const taskAgentToolNames = ['task_update']
const redundantTaskAskPattern =
    /任务目标|任务描述|任务说明|任务需求|当前代码|当前代码块|具体任务|具体.*操作|自动化.*目标|操作目标|目标应用|应用包名|希望.*操作|想.*做什么|需求是什么|提供完整.*需求|提供.*代码/

const parseToolArgsStrict = (value: string) => {
    try {
        const args = JSON.parse(value || '{}')
        if (!args || Array.isArray(args) || typeof args !== 'object') {
            return {ok: false, args: {}, error: '工具参数必须是 JSON object'}
        }
        return {ok: true, args, error: ''}
    } catch (e: any) {
        return {ok: false, args: {}, error: `工具参数 JSON 解析失败：${e.message || e}`}
    }
}

const parseToolArgs = (value: string) => parseToolArgsStrict(value).args

const normalizeTaskAgentResponse = (ret: any, round: number) => {
    const data = ret?.data || {}
    const content = typeof data.content === 'string' ? data.content : ''
    const rawToolCalls = Array.isArray(data.toolCalls) ? data.toolCalls : []
    const errors: string[] = []
    const toolCalls: any[] = []
    if (ret?.code) {
        errors.push(ret.msg || '模型请求失败')
    }
    if (!ret?.data) {
        errors.push('模型响应缺少 data 字段')
    }
    rawToolCalls.forEach((toolCall: any, index: number) => {
        const name = toolCall?.function?.name || ''
        const argsText = toolCall?.function?.arguments || '{}'
        const parsed = parseToolArgsStrict(argsText)
        if (!name) {
            errors.push(`第 ${index + 1} 个工具调用缺少 function.name`)
            return
        }
        if (!taskAgentToolNames.includes(name)) {
            errors.push(`不允许调用工具 ${name}，只能调用 ${taskAgentToolNames.join('、')}`)
            return
        }
        if (!parsed.ok) {
            errors.push(`${name} ${parsed.error}`)
            return
        }
        toolCalls.push({
            ...toolCall,
            id: toolCall.id || `task_agent_${round}_${index + 1}`,
            function: {
                ...toolCall.function,
                arguments: JSON.stringify(parsed.args),
            },
            __args: parsed.args,
        })
    })
    if (!content.trim() && rawToolCalls.length === 0) {
        errors.push('模型响应为空，没有文本也没有工具调用')
    }
    if (rawToolCalls.length > 0 && toolCalls.length === 0) {
        errors.push('模型返回了工具调用，但没有一个工具调用通过本地检测')
    }
    return {
        content,
        toolCalls,
        errors,
        requestId: data._requestId,
    }
}

const buildUserContent = (options: TaskCodeAgentOptions) => {
    const content: any[] = [
        {
            type: 'text',
            text: [
                '=== 本次生成场景 ===',
                '用户正在 LinkAndroid 任务编辑器里请求 AI 修改 Python 自动化任务代码。',
                '本次请求会在真实物理 Android 设备上执行，生成结果必须能直接运行，并通过运行日志验证关键步骤。',
                '',
                `用户需求：${options.requirement}`,
                '',
                '=== 当前任务代码（必须基于此修改，不是重写） ===',
                '```python',
                options.currentCode,
                '```',
                '',
                '=== 当前手机基本信息 ===',
                '```text',
                options.deviceBasicInfo || '未获取到手机基本信息',
                '```',
                '',
                '=== LinkAndroid API 参考 ===',
                LINKANDROID_TASK_API_PROMPT,
                '',
                '=== 当前界面 XML ===',
                '```xml',
                options.xmlInfo || '未获取到 XML 信息',
                '```',
                '',
                '=== 当前截图 ===',
                options.screenshot
                    ? '截图已作为 image_url 附件发送，请结合 XML 识别界面状态。'
                    : '未获取到截图，请只依据 XML、当前代码和用户需求生成。',
                '',
                '=== 开发约束 ===',
                '用户需求可能是自然表达，你需要自行推导合适的 la API、界面观察步骤和输出内容。',
                '不要要求用户提供 API 名称、输出格式或测试标记。',
                '代码必须包含能在物理机运行时观察到的关键日志，例如 app_count=、icon_text=、serial=、battery_level=、store_text=、gallery_tap= 等与场景匹配的前缀。',
                '如果目标控件或应用不存在，代码也必须打印原因并正常结束，不能因为找不到目标直接抛错。',
                '',
                '⚠️ 重点：必须基于"当前任务代码"修改，保留已有操作步骤，在此基础上调整和扩展。禁止丢弃当前代码重写。',
            ].join('\n'),
        },
    ]
    if (options.screenshot) {
        content.push({type: 'image_url', image_url: {url: options.screenshot}})
    }
    return content
}

const taskAgentTools = [
    {
        type: 'function',
        function: {
            name: 'task_update',
            description: '预览并更新当前 LinkAndroid Python 任务代码。code 必须是完整可运行代码。',
            parameters: {
                type: 'object',
                properties: {code: {type: 'string'}, message: {type: 'string'}},
                required: ['code'],
            },
        },
    },
]

const buildTaskAgentSystemPrompt = () =>
    [
        '你是 LinkAndroid 的 Python 任务代码开发 Agent。用户需求就是明确的自动化目标，不要追问、不要让用户补充信息。',
        '你必须像 AI Coding Agent 一样使用工具完成任务：观察手机界面、编辑任务代码、根据校验反馈修复。',
        '用户消息中已经打包了本次具体场景、用户说明、当前任务代码、LinkAndroid API 文档、当前界面 XML 和当前截图；你必须综合这些材料生成更新后的完整代码。',
        '代码必须使用 la 库 API。禁止 import linkandroid、adb、subprocess、os.system、phone_screen。',
        'Python 标准输出只能用内置 print()，不存在 la.print()、device.print()。',
        '代码必须始终以 import la 开头，紧接着写 device = la.device()。',
        '生成代码不能只是展示或打印说明，必须包含真实手机控制动作，并能在物理 Android 设备上直接运行。',
        '生成代码必须为每个关键步骤打印稳定、可断言的日志前缀；信息读取场景要打印具体值，界面操作场景要打印是否找到、是否点击、失败原因。',
        '找不到目标应用、目标文字或目标控件时，必须打印原因并继续安全结束，不要让任务崩溃。',
        '生成代码必须基于用户提供的"当前任务代码"修改（不是重写），在已有操作流程和结构的基础上调整和扩展，不要丢弃当前代码中的已有步骤。',
        '你只能调用 task_update 一个工具。不要调用 asks、device_snapshot 或任何其他工具。',
        '用户需求、当前代码、API 文档、当前 XML 和截图已经全部提供，不允许再向用户索要任务说明、当前代码或界面上下文。',
        '必须直接调用 task_update 提交完整 Python 代码，不要用普通文本结束。',
        '如果收到 task_update 的校验失败反馈，必须按反馈修正代码后再次调用 task_update，不要转为普通文本回复。',
        '禁止编造不存在的 API，例如 device.waitForElement()、device.getElementText()、device.getScreenSize()、Selenium By.XPATH。',
    ].join('\n\n')

const formatUiTargets = (targets: UiTarget[]) => {
    if (targets.length === 0) return '无匹配控件'
    return targets
        .map((item, index) =>
            [
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
                .join(' '),
        )
        .join('\n')
}

const extractTargetsFromXml = (xml: string, keyword = '', maxItems = 30) => {
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
                className: el.getAttribute('class') || '',
                clickable: el.getAttribute('clickable') || '',
                bounds,
                centerX: Math.floor((x1 + x2) / 2),
                centerY: Math.floor((y1 + y2) / 2),
            }
        })
        .filter(Boolean)
        .slice(0, Math.max(1, Math.min(Number(maxItems) || 30, 80))) as UiTarget[]
}

const executeTaskAgentTool = async (options: TaskCodeAgentOptions, toolCall: any) => {
    const name = toolCall.function?.name || ''
    const args = toolCall.__args || parseToolArgs(toolCall.function?.arguments || '')
    if (!taskAgentToolNames.includes(name)) {
        return `工具调用拒绝：不允许调用 ${name}，只能调用 ${taskAgentToolNames.join('、')}`
    }
    if (name === 'task_update') {
        const code = normalizeGeneratedTaskCode(args.code || args.task || '')
        const errors = validateTaskCodeByRequirement(code, options.requirement)
        if (!code) return 'task_update 拒绝：code 为空，请重新生成完整 Python 代码。'
        if (errors.length > 0) {
            return ['task_update 拒绝：代码未通过本地校验，请修复后再次调用 task_update。', ...errors].join('\n')
        }
        return {final: true, code, message: args.message || options.updateReadyMessage}
    }
    return `未知工具：${name}`
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

export const runTaskCodeAgent = async (options: TaskCodeAgentOptions): Promise<TaskCodeAgentResult> => {
    const messages: any[] = [{role: 'user', content: buildUserContent(options)}]
    const localRejectMessages: string[] = []
    const tryFallback = (message: string): TaskCodeAgentResult | null => {
        const fallbackCode = normalizeGeneratedTaskCode(buildRequirementFallbackTaskCode(options.requirement))
        if (fallbackCode && validateTaskCodeByRequirement(fallbackCode, options.requirement).length === 0) {
            return {ok: true, code: fallbackCode, message}
        }
        return null
    }
    for (let round = 1; round <= 5; round++) {
        const ret = await options.chat(
            options.providerId,
            options.modelId,
            options.requirement,
            {
                systemPrompt: buildTaskAgentSystemPrompt(),
                messages,
                tools: taskAgentTools,
                toolChoice: 'required',
                timeoutMs: 60000,
            },
            {loading: false},
        )
        if (ret.code) return {ok: false, message: ret.msg, requestId: ret.data?._requestId}
        const received = normalizeTaskAgentResponse(ret, round)
        if (received.errors.length > 0) {
            messages.push({role: 'assistant', content: received.content || ''})
            messages.push({
                role: 'user',
                content: [
                    '上一轮模型响应未通过本地消息检测，请修正后继续。',
                    ...received.errors.map((item) => `- ${item}`),
                    '必须调用唯一可用工具 task_update 提交完整 Python 代码。',
                ].join('\n'),
            })
            continue
        }
        const toolCalls = received.toolCalls
        if (toolCalls.length === 0) {
            const directCode = normalizeGeneratedTaskCode(received.content || '')
            const directCodeErrors = directCode ? validateTaskCodeByRequirement(directCode, options.requirement) : []
            messages.push({role: 'assistant', content: received.content || ''})
            const repeatedContext = redundantTaskAskPattern.test(received.content || '')
            messages.push({
                role: 'user',
                content: [
                    '上一轮没有工具调用，不能用普通文本结束。',
                    repeatedContext
                        ? [
                              '你刚才要求用户提供任务说明或当前代码，但这些材料已经在第一条用户消息完整提供。',
                              `用户需求：${options.requirement}`,
                              '当前任务代码：',
                              options.currentCode,
                              '下一轮必须直接调用 task_update 提交完整 Python 代码。',
                          ].join('\n')
                        : '',
                    directCode && directCodeErrors.length === 0
                        ? '你返回的文本里像是完整代码，请用 task_update 工具提交同一份完整 Python 代码。'
                        : '你必须调用 task_update 提交最终代码。',
                ]
                    .filter(Boolean)
                    .join('\n'),
            })
            continue
        }
        messages.push({role: 'assistant', content: received.content || '', tool_calls: toolCalls})
        for (const toolCall of toolCalls) {
            const toolResult = await executeTaskAgentTool(options, toolCall)
            if (typeof toolResult === 'object' && toolResult.final) {
                return {ok: true, code: toolResult.code, message: toolResult.message, requestId: received.requestId}
            }
            if (typeof toolResult === 'object' && toolResult.userInputRequired) {
                return {
                    ok: false,
                    message: toolResult.question,
                    ask: {question: toolResult.question, options: toolResult.options},
                }
            }
            if (String(toolResult).startsWith('task_update 拒绝')) {
                localRejectMessages.push(String(toolResult))
                const fallbackResult =
                    localRejectMessages.length >= 2
                        ? tryFallback('模型连续生成不可用代码，已切换为本地可运行任务代码。')
                        : null
                if (fallbackResult) return fallbackResult
            }
            messages.push({role: 'tool', tool_call_id: toolCall.id, content: String(toolResult)})
        }
        if (round === 3) {
            messages.push({
                role: 'user',
                content: '你已经获得足够上下文。下一轮必须调用唯一可用工具 task_update 提交完整 Python 代码。',
            })
        }
    }
    const fallbackResult = tryFallback('模型未在限定轮次内完成提交，已根据需求生成可运行任务代码。')
    if (fallbackResult) return fallbackResult
    return {
        ok: false,
        message: [
            'Agent 已达到最大工具调用轮次，尚未生成可用任务代码。',
            localRejectMessages.length > 0 ? '最后一次本地校验反馈：' : '',
            localRejectMessages.slice(-1)[0] || '',
        ]
            .filter(Boolean)
            .join('\n'),
    }
}
