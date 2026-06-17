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
    'la.util.json_loads(text) -> object：解析 JSON 字符串。',
    'la.util.json_dumps(data) -> str：序列化 JSON。',
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
    'device.double_click(x: int, y: int, duration: float=0.1)：双击。',
    'device.long_click(x: int, y: int, duration: float=0.5)：长按。',
    'device.swipe(fx: int, fy: int, tx: int, ty: int, duration: float=0.5)：从起点滑到终点。',
    'device.swipe_ext(direction: str, scale: float=0.8)：按方向滑动，direction 只能是 up/down/left/right。',
    'device.swipe_to(direction: str, text: str|None=None, timeout: float=10) -> bool：滑动直到目标文字出现。',
    'device.drag(fx: int, fy: int, tx: int, ty: int, duration: float=0.5)：拖拽。',
    'device.scroll_forward() / device.scroll_backward()：滚动。',
    '',
    '===== 文字输入 =====',
    'device.text(text: str, clear: bool=False, enter: bool=False)：输入文本；clear=True 先清空，enter=True 输入后回车。',
    'device.input_text(text: str, clear: bool=False, enter: bool=False)：输入文本。',
    'device.clear_text()：清空输入框。',
    'device.send_keys(text: str)：逐字符发送。',
    'device.type_text(text: str)：输入文本别名。',
    '',
    '===== 截图与 XML =====',
    'device.screenshot(filename: str|None=None, quality: int=90)：截图；filename 为空时返回图片数据。',
    'device.dump_hierarchy() -> str：获取当前界面 XML。',
    'device.dump_xml_to_file(path: str)：保存 XML 到文件。',
    '',
    '===== 元素选择与等待 =====',
    '选择器参数统一为：text、className、resourceId、description(content-desc)、packageName、index。',
    'device.selector(text=None, className=None, resourceId=None, description=None, packageName=None, index=None)：构造选择器。',
    'device.select(...)：selector 别名，参数同 selector。',
    'device.find(text=None, className=None, resourceId=None, description=None, packageName=None, index=None) -> UIElement|None：查找第一个元素。',
    'device.find_all(text=None, className=None, resourceId=None, description=None, packageName=None) -> list[UIElement]：查找所有元素。',
    'device.exists(text=None, className=None, resourceId=None, description=None, timeout=0) -> bool：判断元素是否存在。',
    'device.count(text=None, className=None, resourceId=None, description=None) -> int：统计匹配元素数量。',
    'device.wait(text=None, className=None, resourceId=None, description=None, timeout=10) -> bool：等待元素出现。',
    'device.find_by_xpath(xpath: str)：XPath 查找。',
    '',
    '===== 快捷点击 =====',
    'device.click_text(text: str, timeout: float=10)：按 text 点击。',
    'device.tap_text(text: str, timeout: float=10)：按 text 点击，常用于点击桌面图标/按钮文字。',
    'device.tap_desc(description: str, timeout: float=10)：按 content-desc 点击。',
    'device.tap_id(resourceId: str, timeout: float=10)：按 resource-id 点击。',
    'device.tap_exists(timeout: float=3, **selector) -> bool：存在则点击；示例 device.tap_exists(text="允许", timeout=3)。',
    'device.click_if_exists(timeout: float=3, **selector) -> bool：tap_exists 别名。',
    '',
    '===== UIElement 操作 =====',
    'device.click_element(element)：点击元素对象。',
    'device.click_center(element)：点击元素中心。',
    'device.get_text(element) -> str：获取元素文本。',
    'device.get_bounds(element) -> dict：获取元素边界 {left, top, right, bottom}。',
    'device.center(element) -> tuple：获取元素中心点 (x, y)。',
    'device.info(element) -> dict：获取元素 info 属性。',
    '',
    '===== 应用管理 =====',
    'device.app_start(package_name: str, activity: str|None=None)：启动应用；activity 可省略。',
    'device.app_stop(package_name: str)：停止应用。',
    'device.app_clear(package_name: str)：清除应用数据。',
    'device.app_current() -> dict：当前前台应用 {"package": str, "activity": str}。',
    'device.app_list() -> list[str]：应用包名列表。',
    'device.app_install(url_or_path: str)：安装 APK。',
    'device.app_uninstall(package_name: str)：卸载应用。',
    'device.current_package() -> str：当前前台包名。',
    'device.current_activity() -> str：当前前台 Activity。',
    '',
    '===== 按键 =====',
    'device.press(key: str)：按键，key 可为 home/back/enter/delete/search/volume_up 等。',
    'device.home() / device.back() / device.menu() / device.recent() / device.power()。',
    'device.press_home() / device.press_back() / device.press_menu() / device.press_recent() / device.press_power()。',
    'device.press_enter() / device.press_del()。',
    '',
    '===== 屏幕与设备信息 =====',
    'device.width() -> int：屏幕宽度。',
    'device.height() -> int：屏幕高度。',
    'device.size() -> tuple：屏幕尺寸 (width, height)。',
    'device.is_screen_on() -> bool：屏幕是否亮。',
    'device.screen_on()：点亮屏幕。',
    'device.screen_off()：熄灭屏幕。',
    'device.unlock()：滑动解锁。',
    'device.device_info() -> dict：品牌、型号、Android 版本等完整设备信息。',
    'device.serial() -> str：设备序列号。',
    'device.wlan_ip() -> str：WLAN IP。',
    'device.battery() -> dict：电池信息，含 level、temperature、status 等字段。',
    'device.memory_info() -> dict：内存信息，含 total、available 等字段。',
    'device.cpu_info() -> dict：CPU 信息。',
    '',
    '===== 系统面板、剪贴板、录屏、URL =====',
    'device.open_notification()：打开通知栏。',
    'device.open_quick_settings()：打开快捷设置。',
    'device.set_clipboard(text: str)：设置剪贴板。',
    'device.get_clipboard() -> str：读取剪贴板。',
    'device.start_screen_record(path: str)：开始录屏。',
    'device.stop_screen_record()：停止录屏。',
    'device.open_url(url: str)：用系统浏览器打开 URL。',
    'device.toast(message: str, duration: float=2)：显示 Toast。',
    'device.set_fast_input_ime(enable: bool=True)：开关快速输入法。',
    '',
    '===== 等待 =====',
    'device.wait_idle(timeout: float=10) -> bool：等待设备空闲。',
    'device.wait_activity(activity: str, timeout: float=10) -> bool：等待 Activity，支持正则。',
    'device.wait_until(condition, timeout: float=10, interval: float=1) -> bool：等待自定义条件成立。',
    'device.wait_until_gone(text=None, className=None, resourceId=None, description=None, timeout: float=10) -> bool：等待元素消失。',
    'device.error：通用异常别名，可用于 except。',
    '',
    '===== 多设备 =====',
    'devices = la.devices()：获取多设备列表。',
    'la.multi.click(devices, x, y)：多设备点击。',
    'la.multi.back(devices)：多设备返回。',
    'for ds in devices: print(ds.serial()); ds.click(x, y)：遍历多设备。',
    '',
    '===== 需求到 API 的常见映射 =====',
    '- 设备基础信息：device.home(), serial(), width(), height(), battery(), app_current()',
    '- 手机体检/品牌/型号/系统版本/内存：device.home(), device_info(), battery(), memory_info(), serial()',
    '- 应用清单/有哪些应用：device.home(), app_list()，逐项 print 包名',
    '- 桌面图标/按钮/文字：device.home(), dump_hierarchy()，用 re 提取 text/content-desc 后 print',
    '- 打开相册/图库：优先 device.tap_text("相册", timeout=3)，并打印 gallery_tap=',
    '- 打开应用商店：优先尝试 tap_text("应用商店"/"应用市场")，打开后 dump_hierarchy() 并打印页面文字',
    '',
    '===== 常见错误 API（禁止使用） =====',
    '- 不存在 device.wait_for_element()、device.get_element_text()、device.get_screen_size()。',
    '- 不要导入 selenium.webdriver.common.by.By，不要写 By.XPATH。',
    '- 不要使用 driver、find_element、phone_screen、adb、subprocess、os.system。',
    '- 获取页面文字用 device.dump_hierarchy() 或 device.find_all()；点击文字用 device.tap_text()。',
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
            /\b(?:device|la)\.(?:home|back|menu|recent|power|press|screen_on|screen_off|unlock)\s*\(/,
            /\b(?:device|la)\.(?:click|tap|double_click|long_click|swipe|swipe_ext|swipe_to|drag)\s*\(/,
            /\b(?:device|la)\.(?:tap_text|tap_desc|tap_id|tap_exists|click_text|click_if_exists)\s*\(/,
            /\b(?:device|la)\.(?:app_start|app_stop|input_text|text|clear_text|send_keys)\s*\(/,
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
        if (!/\b(?:device|la)\.(?:dump_hierarchy|find_all)\s*\(/.test(executableCode)) {
            errors.push('涉及当前界面图标/按钮/文字时，必须动态读取界面')
        }
    }
    if (!isStoreRequirement && /应用列表|所有应用|app_list|应用清单|有哪些应用|手机里.*应用/.test(requirement)) {
        if (!/\b(?:device|la)\.app_list\s*\(/.test(executableCode)) {
            errors.push('涉及手机应用清单时必须调用 device.app_list()')
        }
        if (!/print\s*\([^)]*["'](?:app_count|app_pkg)=/.test(executableCode)) {
            errors.push('涉及手机应用清单时必须打印应用数量或应用包名')
        }
    }
    if (/设置/.test(requirement) && /打开|点击|找到|尝试/.test(requirement)) {
        if (
            !/\b(?:device|la)\.(?:tap_text|tap_exists|click_if_exists|exists|find|dump_hierarchy|app_start)\s*\(/.test(
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
            /\b(?:device|la)\.app_current\s*\(/,
            /\b(?:device|la)\.current_package\s*\(/,
            /\b(?:device|la)\.current_activity\s*\(/,
        ])
        if (infoCount < 4) {
            errors.push('设备状态任务必须读取序列号、屏幕尺寸、电量和当前应用等真实设备信息')
        }
    }
    if (isDiagnoseRequirement) {
        const diagnoseCount = countMatches([
            /\b(?:device|la)\.device_info\s*\(/,
            /\b(?:device|la)\.battery\s*\(/,
            /\b(?:device|la)\.memory_info\s*\(/,
            /\b(?:device|la)\.cpu_info\s*\(/,
            /\b(?:device|la)\.serial\s*\(/,
            /\b(?:device|la)\.wlan_ip\s*\(/,
        ])
        if (diagnoseCount < 3) {
            errors.push('设备体检任务必须读取 device_info、battery、memory_info 等诊断信息')
        }
    }
    if (/相册|图库|照片/.test(requirement)) {
        if (!/\b(?:device|la)\.(?:tap_text|tap_exists|app_start)\s*\(/.test(executableCode)) {
            errors.push('涉及打开相册时必须调用真实操作')
        }
        if (!/(相册|图库|照片|gallery|album)/i.test(executableCode)) {
            errors.push('涉及打开相册时，代码必须明确定位相册/图库/照片或 gallery/album 应用')
        }
    }
    if (isStoreRequirement) {
        if (!/\b(?:device|la)\.(?:dump_hierarchy|find_all)\s*\(/.test(executableCode)) {
            errors.push('应用商店任务必须打开后读取页面 XML 或控件内容')
        }
        if (!/\b(?:device|la)\.(?:tap_text|tap_exists|app_start)\s*\(/.test(executableCode)) {
            errors.push('应用商店任务必须包含打开商店的真实操作')
        }
    }
    return errors
}

const pythonString = (value: string) => value.replace(/\\/g, '\\\\').replace(/'''/g, "\\'\\'\\'")

const taskAgentToolNames = ['device_snapshot', 'task_update', 'asks']

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
                `用户需求：${options.requirement}`,
                '',
                '=== 当前任务代码（必须基于此修改，不是重写） ===',
                '```python',
                options.currentCode,
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
                '=== 开发约束 ===',
                '用户需求可能是自然表达，你需要自行推导合适的 la API、界面观察步骤和输出内容。',
                '不要要求用户提供 API 名称、输出格式或测试标记。',
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
            name: 'device_snapshot',
            description: '观察真实手机当前状态，返回 XML 摘要、截图状态、前台应用和可定位控件，用于写任务脚本。',
            parameters: {type: 'object', properties: {maxXmlChars: {type: 'number'}}},
        },
    },
    {
        type: 'function',
        function: {
            name: 'asks',
            description:
                '当需求或风险无法自行判断时，向用户提出一个明确选择题并暂停生成。必须提供 2-4 个可点击选项，界面会自动追加“自己填”。',
            parameters: {
                type: 'object',
                properties: {
                    content: {type: 'string'},
                    question: {type: 'string'},
                    options: {
                        type: 'array',
                        items: {type: 'string'},
                        description:
                            '候选答案标签，例如 ["继续生成", "取消本次生成"]。不要包含“自己填”，界面会自动追加。',
                    },
                },
                required: ['question', 'options'],
            },
        },
    },
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
        '代码必须使用 la 库 API。禁止 import linkandroid、adb、subprocess、os.system、phone_screen。',
        'Python 标准输出只能用内置 print()，不存在 la.print()、device.print()。',
        '代码必须始终以 import la 开头，紧接着写 device = la.device()。',
        '生成代码不能只是展示或打印说明，必须包含真实手机控制动作。',
        '你只能调用三个工具：device_snapshot、task_update、asks。不要设想或调用其他工具。',
        '如果用户需求已经足够明确，优先调用 task_update 直接提交代码；只有需要当前界面上下文时才先调用 device_snapshot。',
        '如果收到 task_update 的校验失败反馈，必须按反馈修正代码后再次调用 task_update，不要转为普通文本回复。',
        '只有完成观察/推理并准备提交最终代码时，才调用 task_update。',
        '只有缺少账号、密码、包名、危险操作确认等用户私有信息时，才调用 asks。',
        '调用 asks 时必须提供 options 数组，包含 2-4 个用户可点击的候选答案；不要把“自己填”放入 options，界面会自动追加。',
        '禁止编造不存在的 API，例如 device.wait_for_element()、device.get_element_text()、device.get_screen_size()、Selenium By.XPATH。',
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
    if (name === 'device_snapshot') {
        const maxXmlChars = Math.max(1000, Math.min(Number(args.maxXmlChars) || 12000, 30000))
        const xml = await options.collectXml(options.selectedDeviceId)
        let hasScreenshot = false
        try {
            hasScreenshot = !!(await options.collectScreenshot(options.selectedDeviceId))
        } catch {
            hasScreenshot = false
        }
        const infoController = await options.runPython(
            [
                'import la',
                'device = la.device()',
                'print("serial=" + device.serial())',
                'print("current_package=" + device.current_package())',
                'print("current_activity=" + device.current_activity())',
            ].join('\n'),
            options.selectedDeviceId,
        )
        return [
            await infoController.result(),
            `screenshot=${hasScreenshot ? 'ok' : 'unavailable'}`,
            `xml_length=${xml.length}`,
            'ui_targets=',
            formatUiTargets(extractTargetsFromXml(xml, '', 20)),
            'xml_preview=',
            xml.slice(0, maxXmlChars),
        ].join('\n')
    }
    if (name === 'asks') {
        const question = args.question || args.content || '请确认需求'
        const askOptions = Array.isArray(args.options)
            ? args.options
                  .filter((item: any) => String(item || '').trim())
                  .map((item: any) => String(item).trim())
                  .slice(0, 4)
            : []
        if (
            /任务目标|任务描述|具体任务|具体.*操作|自动化.*目标|操作目标|目标应用|应用包名|希望.*操作|想.*做什么|需求是什么/.test(
                question,
            ) &&
            options.requirement.trim()
        ) {
            return [
                '用户需求已经在上文给出，不要再次询问任务目标、任务描述或目标应用包名。',
                `用户需求：${options.requirement}`,
                '请根据用户需求和 API 参考继续观察或直接用 task_update 提交代码。',
            ].join('\n')
        }
        return {
            userInputRequired: true,
            question,
            options: askOptions.length > 0 ? askOptions : ['按推荐方案继续', '取消本次生成'],
        }
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
    if (hasStore) {
        return [
            'import la',
            'device = la.device()',
            'import re',
            'device.home()',
            'opened = False',
            'for name in ["应用商店", "应用市场", "商店", "应用商城"]:',
            '    if device.tap_text(name, timeout=3):',
            '        print("store_opened=" + name)',
            '        opened = True',
            '        break',
            'if not opened:',
            '    print("store_opened=false")',
            '    print("store_reason=desktop icon not found by text: 应用商店/应用市场/商店/应用商城")',
            'la.sleep(2)',
            'xml = device.dump_hierarchy()',
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
            'xml = device.dump_hierarchy()',
            'texts = re.findall(r\'(?:text|content-desc)="([^"]+)"\', xml)',
            'for item in texts:',
            '    if item.strip():',
            '        print("icon_text=" + item.strip())',
            'print("gallery_tap=" + str(device.tap_text("相册", timeout=3)))',
        ].join('\n')
    }
    if (wantsDiagnose) {
        return [
            'import la',
            'device = la.device()',
            'device.home()',
            'info = device.device_info()',
            'print("brand=" + str(info.get("brand", "")))',
            'print("model=" + str(info.get("model", "")))',
            'print("android_version=" + str(info.get("version", info.get("android_version", ""))))',
            'battery = device.battery()',
            'print("battery_level=" + str(battery.get("level", "")))',
            'memory = device.memory_info()',
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
            'current = device.app_current()',
            'print("current_package=" + str(current.get("package", "")))',
            'print("current_activity=" + str(current.get("activity", "")))',
        ].join('\n')
    }
    if (hasGallery || wantsAppList) {
        return [
            'import la',
            'device = la.device()',
            'device.home()',
            'apps = device.app_list()',
            'print("app_count=" + str(len(apps)))',
            'for pkg in apps[:50]:',
            '    print("app_pkg=" + str(pkg))',
            hasGallery
                ? 'print("gallery_tap=" + str(device.tap_text("相册", timeout=3)))'
                : 'print("settings_tap=" + str(device.tap_text("设置", timeout=3)))',
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
                    `必须调用 ${taskAgentToolNames.join('、')} 之一；完成代码时必须调用 task_update。`,
                ].join('\n'),
            })
            continue
        }
        const toolCalls = received.toolCalls
        if (toolCalls.length === 0) {
            const directCode = normalizeGeneratedTaskCode(received.content || '')
            const directCodeErrors = directCode ? validateTaskCodeByRequirement(directCode, options.requirement) : []
            messages.push({role: 'assistant', content: received.content || ''})
            messages.push({
                role: 'user',
                content: [
                    '上一轮没有工具调用，不能用普通文本结束。',
                    directCode && directCodeErrors.length === 0
                        ? '你返回的文本里像是完整代码，请用 task_update 工具提交同一份完整 Python 代码。'
                        : '你必须选择 device_snapshot、task_update、asks 三个工具之一继续，或调用 task_update 提交最终代码。',
                ].join('\n'),
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
                content: '你已经获得足够上下文。下一轮必须调用 task_update 提交完整 Python 代码。',
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
