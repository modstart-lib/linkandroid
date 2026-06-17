<script setup lang="ts">
import {computed, nextTick, onMounted, ref} from 'vue'
import {t} from '../../lang'
import {Dialog} from '../../lib/dialog'
import {useModelStore} from '../../module/Model/store/model'
import {getModelLogo} from '../../module/Model/models'
import {StorageUtil} from '../../lib/storage'
import TaskUpdatePreviewDialog from './TaskUpdatePreviewDialog.vue'
import {collectDeviceScreenshotByLa, collectDeviceXmlByLa, runTaskPythonCode} from './TaskRuntime'
import {runTaskCodeAgent as runTaskCodeAgentCore} from './TaskCodeAgent'

const props = defineProps<{
    currentCode: string
    selectedDeviceId: string
}>()

const emit = defineEmits<{
    updateCode: [code: string]
}>()

interface ChatMessage {
    id: string
    role: 'user' | 'assistant'
    content: string
    timestamp: string
    ask?: ChatAsk
}

interface ChatAsk {
    question: string
    options: string[]
    choice: string
    custom: string
    answered: string
    sourcePrompt: string
}

const messages = ref<ChatMessage[]>([])
const inputText = ref('')
const loading = ref(false)
const messageContainer = ref<HTMLDivElement | null>(null)
const updatePreviewDialog = ref<InstanceType<typeof TaskUpdatePreviewDialog> | null>(null)
const customAskChoice = '__custom__'

const modelStore = useModelStore()
const selectedModel = ref<string>('')
const bizKey = 'task.chat'

type ModelOption = {
    value: string
    label: string
    modelId: string
    providerId: string
    providerTitle: string
    caps?: {vision?: boolean; tools?: boolean}
}

const LINKANDROID_TASK_API_PROMPT = [
    '===== 运行环境 =====',
    '- 必须 import la（不是 import linkandroid！），默认第一步写 device = la.device()',
    '- 只能用 la 库 API，禁止使用 phone_screen、adb、subprocess、os.system、Selenium、Appium、Playwright',
    '- 输出用 Python 内置 print()，不要用 la.print()（la 没有 print API）',
    '- 默认单设备，不要默认同步操作多台手机',
    '',
    '===== 基础结构 =====',
    'import la',
    'device = la.device()         # 单设备代理（推荐）',
    '# device.raw() 获取原生 uiautomator2 Device',
    '',
    '===== 按键 =====',
    'device.home()',
    'device.back()',
    'device.menu() / device.recent() / device.power()',
    'device.press("home") / press("back") / press("enter") / press("delete") / press("search") / press("volume_up")',
    '',
    '===== 坐标点击/滑动 =====',
    'device.click(x, y)',
    'device.tap(x, y)             # click 别名',
    'device.double_click(x, y)',
    'device.long_click(x, y)',
    'device.swipe(fx, fy, tx, ty)',
    'device.swipe_ext("up")       # down/left/right',
    'device.swipe_to("up", text="设置")  # 滑动直到目标出现',
    'device.drag(fx, fy, tx, ty)',
    '',
    '===== 元素选择 =====',
    'device.selector(text="设置")                        # Selector 对象',
    'device.select(id="com.android.settings:id/search")  # selector 别名',
    'device.find(text="确定")                            # UIElement | None',
    'device.find_all(text="确定", className="android.widget.Button")',
    'device.exists(text="确定")                          # bool',
    'device.count(text="确定")                           # int',
    'device.wait(text="确定", timeout=10)                # bool 等待元素出现',
    '',
    '===== 快捷点击 =====',
    'device.tap_text("确定")              # 按 text 点击',
    'device.tap_text("确定", timeout=5)   # 等待最多5秒后点击',
    'device.tap_desc("更多", timeout=5)   # 按 content-desc 点击',
    'device.tap_id("com.pkg:id/submit")   # 按 resource-id 点击',
    'device.tap_exists(text="允许", timeout=3)            # 存在则点击, 返回 bool',
    'device.click_if_exists(...)                         # tap_exists 别名',
    '',
    '===== 元素交互 =====',
    'device.click_element(element)         # 点击元素对象',
    'device.click_center(element)          # 点击元素中心',
    'device.get_text(element)              # str 元素文本',
    'device.get_bounds(element)            # dict {left, top, right, bottom}',
    'device.center(element)                # (x, y) 中心坐标',
    'device.info(element)                  # dict 元素全部属性',
    '',
    '===== 文字输入 =====',
    'device.input_text("内容", clear=True)   # 先清除再输入',
    'device.text("内容")                     # 直接输入',
    'device.clear_text()                     # 清除输入框',
    'device.send_keys("内容")                # 逐字符发送',
    '',
    '===== 截图和 XML =====',
    'device.screenshot("shot.png")          # 截图保存到文件',
    'device.dump_hierarchy()                # str 当前界面 XML',
    'device.dump_xml_to_file("ui.xml")      # 保存 XML 到文件',
    '',
    '===== 应用管理 =====',
    'device.app_start("com.android.settings")',
    'device.app_stop("com.android.settings")',
    'device.app_clear("com.android.settings")',
    'device.app_current()                    # {"package":"...", "activity":"..."}',
    'device.app_list()                       # [str] 已安装应用包名列表',
    'device.current_package()                # str 前台应用包名',
    'device.current_activity()               # str 前台 Activity',
    'device.app_install(url_or_path)',
    'device.app_uninstall("com.pkg")',
    '',
    '===== 设备信息 =====',
    'device.width()      # int',
    'device.height()     # int',
    'device.size()       # (w, h)',
    'device.serial()     # str 序列号',
    'device.wlan_ip()    # str WiFi IP',
    'device.battery()    # dict {level, temperature, status}',
    '',
    '===== 等待和休眠 =====',
    'device.wait(timeout=5)                            # 等待设备空闲',
    'device.wait(text="设置", timeout=10)              # 等待元素出现',
    'device.wait_until(lambda: device.exists(text="x"), timeout=10)',
    'device.wait_until_gone(text="加载中", timeout=10) # 等待元素消失',
    'device.wait_activity(".Settings", timeout=10)     # bool',
    'la.sleep(1)                    # 线程休眠 1 秒',
    'la.util.sleep(1)',
    '',
    '===== 屏幕操作 =====',
    'device.is_screen_on()    # bool',
    'device.screen_on()       # 点亮屏幕',
    'device.screen_off()      # 关闭屏幕',
    'device.unlock()          # 解锁',
    '',
    '===== 工具和网络 =====',
    'la.util.now()                                         # ISO 时间',
    'la.util.json_loads(\'{"a":1}\') / la.util.json_dumps({"a":1})',
    'la.util.retry(lambda: device.exists(text="确定"), times=3, interval=1)',
    'la.http.get("https://example.com", params={"k":"v"})',
    'la.http.post("https://example.com", json={"k":"v"})',
    'la.http.request("GET", url, **kwargs)',
    'la.http.json("POST", url, json={"k":"v"})            # 返回 dict',
    '',
    '===== 多设备 =====',
    'devices = la.devices()',
    'la.multi.click(devices, x, y)',
    'la.multi.back(devices)',
    'for ds in devices:',
    '    print(ds.serial())',
    '    ds.click(x, y)',
    '',
    '===== 原生 uiautomator2 出口 =====',
    'd = device.raw()  # 或 d = la.raw()',
    'd(text="设置").click()',
    'd(resourceId="pkg:id/name").exists',
    'd.xpath("//android.widget.TextView").all()',
    '',
    '===== 🔥 完整示例 1：遍历应用列表，按名称查找并打开 =====',
    'import la',
    'device = la.device()',
    'apps = device.app_list()',
    'found = False',
    'for pkg in apps:',
    '    if "相册" in pkg or "gallery" in pkg or "照片" in pkg:',
    '        device.app_start(pkg)',
    '        print("opened: " + pkg)',
    '        found = True',
    '        break',
    'if not found:',
    '    print("no gallery app found")',
    '',
    '===== 🔥 完整示例 2：在当前界面查找文字并点击 =====',
    'import la',
    'device = la.device()',
    'xml = device.dump_hierarchy()',
    'if device.exists(text="确定"):',
    '    device.tap_text("确定")',
    '    print("clicked 确定")',
    'elif device.exists(text="取消"):',
    '    device.tap_text("取消")',
    'else:',
    '    print("no dialog found")',
    '',
    '===== 🔥 完整示例 3：滑动列表直到找到目标 =====',
    'import la',
    'device = la.device()',
    'found = device.swipe_to("up", text="蓝牙")',
    'if found:',
    '    device.tap_text("蓝牙")',
    '    print("bluetooth clicked")',
    'else:',
    '    device.back()',
    '    print("not found, went back")',
    '',
    '===== 🔥 完整示例 4：等待元素出现后读取文本 =====',
    'import la',
    'device = la.device()',
    'if device.wait(text="进度", timeout=5):',
    '    elem = device.find(text="进度")',
    '    val = device.get_text(elem)',
    '    print("progress=" + val)',
    '',
    '===== 🔥 完整示例 5：列出当前界面所有可点击的文字/图标按钮，然后点击指定项 =====',
    'import la',
    'import re',
    'device = la.device()',
    'device.home()',
    'xml = device.dump_hierarchy()',
    '# 提取所有可点击且有 text 的节点',
    'buttons = re.findall(r\'text="([^"]+)"[^>]*clickable="true"\', xml)',
    'if not buttons:',
    '    # 降级：提取所有有 text 的节点',
    '    buttons = re.findall(r\'text="([^"]+)"\', xml)',
    '# 去重并过滤空文本',
    'buttons = sorted(set(b for b in buttons if b.strip()))',
    'print("all_buttons=" + ", ".join(buttons))',
    'if "相册" in buttons:',
    '    device.tap_text("相册")',
    '    print("clicked 相册")',
    'else:',
    '    print("相册 not found")',
    '',
    '===== 🔥 完整示例 6：打开指定应用后读取界面内容 =====',
    'import la',
    'import re',
    'device = la.device()',
    '# 查找应用商店包名',
    'apps = device.app_list()',
    'store_pkg = None',
    'for pkg in apps:',
    '    if "market" in pkg or "store" in pkg or "应用商店" in pkg:',
    '        store_pkg = pkg',
    '        break',
    'if store_pkg:',
    '    device.app_start(store_pkg)',
    '    la.sleep(3)',
    '    xml = device.dump_hierarchy()',
    '    texts = re.findall(r\'text="([^"]+)"\', xml)',
    '    texts = sorted(set(t for t in texts if t.strip()))',
    '    print("recommended_apps=" + ", ".join(texts))',
    'else:',
    '    print("app_store not found")',
    '',
    '===== 硬性规则 =====',
    '1. 用户明确要求的 API 调用、固定打印文本、验证步骤必须逐字实现',
    '2. XML 和截图只能作为定位参考，不能替换或改变用户任务',
    '3. 必须基于当前任务代码修改（不是重写），保留原有结构和功能的基础上调整',
    '4. 禁止自创 API：不能使用 la.print()、device.print()、phone_screen.click、device.find_element、driver 等不存在的 API',
    '5. Python 标准输出只能用内置 print()，不存在 la.print()、device.print() 等 API',
    '6. 异常处理用 except Exception as e',
    '7. 必须返回完整可运行任务，不要引用未定义的 helper',
    '8. ⚠️ 代码必须始终以 `import la` 开头，紧接着写 `device = la.device()`。禁止省略。',
    '9. ⚠️ 当用户要求"列出""显示""获取当前页面所有/有哪些"图标、按钮、文字时，必须用 `device.dump_hierarchy()` 动态解析 XML 提取 text/content-desc，禁止硬编码列表。',
].join('\n')

const modelOptions = computed<ModelOption[]>(() => {
    const options: ModelOption[] = []
    for (const p of modelStore.providers) {
        if (p.id === 'buildIn') {
            // 官方模型始终显示在下拉列表中
            for (const m of p.data.models) {
                options.push({
                    value: `${p.id}|${m.id}`,
                    label: `${p.title} / ${m.label || m.name}`,
                    modelId: m.id,
                    providerId: p.id,
                    providerTitle: p.title,
                    caps: m.caps,
                })
            }
        } else {
            if (!p.data.enabled) continue
            if (!p.apiUrl && !p.data.apiHost) continue
            for (const m of p.data.models) {
                if (!m.enabled) continue
                if (!m.caps?.vision) continue
                options.push({
                    value: `${p.id}|${m.id}`,
                    label: `${p.title} / ${m.label || m.name}`,
                    modelId: m.id,
                    providerId: p.id,
                    providerTitle: p.title,
                    caps: m.caps,
                })
            }
        }
    }
    return options
})

const selectedOption = computed(() => {
    return modelOptions.value.find((o) => o.value === selectedModel.value) || null
})

const resolveTestModelValue = (model: string) => {
    if (model === 'llmpx/default') {
        return (
            modelOptions.value.find((option) => option.value === 'buildIn|default') ||
            modelOptions.value.find(
                (option) =>
                    option.modelId === 'default' &&
                    (option.providerId === 'llmpx' || /llmpx|官方/i.test(option.providerTitle)),
            ) ||
            null
        )
    }
    return modelOptions.value.find((option) => option.value === model.replace('/', '|')) || null
}

onMounted(() => {
    const saved = StorageUtil.get(`ModelGenerator.${bizKey}`, '')
    if (saved && modelOptions.value.some((o) => o.value === saved)) {
        selectedModel.value = saved
    } else if (modelOptions.value.length > 0) {
        selectedModel.value = modelOptions.value[0].value
    }
})

let msgIdCounter = 0
const genId = () => `chat_${Date.now()}_${++msgIdCounter}`

const addMessage = (role: 'user' | 'assistant', content: string, ask?: ChatAsk) => {
    messages.value.push({
        id: genId(),
        role,
        content,
        timestamp: new Date().toISOString(),
        ask,
    })
}

const debugLog = (label: string, data: Record<string, any> = {}) => {
    window.$mapi?.log?.info(`Script.Chat.${label}`, data).catch(() => {})
}

const scrollToBottom = () => {
    nextTick(() => {
        if (messageContainer.value) {
            messageContainer.value.scrollTop = messageContainer.value.scrollHeight
        }
    })
}

const parseToolArgs = (value: string) => {
    try {
        return JSON.parse(value || '{}')
    } catch {
        return {}
    }
}

const normalizeGeneratedTaskCode = (code: string) => {
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

const validateGeneratedTaskCode = (code: string) => {
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
        /\b(?:device|la)\.(?:home|back|menu|recent|power|press|screen_on|screen_off|unlock)\s*\(/,
        /\b(?:device|la)\.(?:click|tap|double_click|long_click|swipe|swipe_ext|swipe_to|drag)\s*\(/,
        /\b(?:device|la)\.(?:tap_text|tap_desc|tap_id|tap_exists|click_text|click_if_exists)\s*\(/,
        /\b(?:device|la)\.(?:app_start|app_stop|input_text|text|clear_text|send_keys)\s*\(/,
    ]
    if (!controlPatterns.some((pattern) => pattern.test(code))) {
        errors.push('代码必须包含至少一个真实手机控制动作，例如 device.home()、device.tap_text() 或 device.app_start()')
    }
    return errors
}

const validateTaskCodeByRequirement = (code: string, requirement: string) => {
    const errors = validateGeneratedTaskCode(code)
    const countMatches = (patterns: RegExp[]) => patterns.filter((pattern) => pattern.test(code)).length
    if (/列出|显示|获取|枚举/.test(requirement) && /图标|按钮|文字|当前界面|首页/.test(requirement)) {
        if (!/\b(?:device|la)\.(?:dump_hierarchy|find_all)\s*\(/.test(code)) {
            errors.push(
                '涉及当前界面图标/按钮/文字时，必须用 device.dump_hierarchy() 或 device.find_all() 动态读取界面',
            )
        }
    }
    if (/应用列表|所有应用|app_list/.test(requirement) && !/\b(?:device|la)\.app_list\s*\(/.test(code)) {
        errors.push('涉及应用列表时必须调用 device.app_list() 或 la.app_list()')
    }
    if (/应用清单|应用列表|有哪些应用|手机里.*应用/.test(requirement) && !/\b(?:device|la)\.app_list\s*\(/.test(code)) {
        errors.push('涉及手机应用清单时必须调用 device.app_list()')
    }
    if (/序列号|屏幕尺寸|电量|当前应用|设备状态/.test(requirement)) {
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
    if (/体检|品牌|型号|系统版本|内存/.test(requirement)) {
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
    if (/相册|图库|照片/.test(requirement) && !/\b(?:device|la)\.(?:tap_text|tap_exists|app_start)\s*\(/.test(code)) {
        errors.push('涉及打开相册时必须调用 device.tap_text/device.tap_exists/device.app_start 等真实操作')
    }
    if (/相册|图库|照片/.test(requirement) && !/(相册|图库|照片|gallery|album)/i.test(code)) {
        errors.push('涉及打开相册时，代码必须明确定位相册/图库/照片或 gallery/album 应用')
    }
    if (/应用商店|应用市场|商店/.test(requirement)) {
        if (!/\b(?:device|la)\.(?:dump_hierarchy|find_all)\s*\(/.test(code)) {
            errors.push('应用商店任务必须打开后读取页面 XML 或控件内容')
        }
        if (!/\b(?:device|la)\.(?:tap_text|tap_exists|app_start)\s*\(/.test(code)) {
            errors.push('应用商店任务必须包含打开商店的真实操作')
        }
    }
    return errors
}

const buildRequirementFallbackTaskCode = (requirement: string) => {
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
            '        if device.tap_text(name, timeout=3):',
            '            print("store_opened=" + name)',
            '            opened = True',
            '            break',
            '    except Exception as e:',
            '        print("store_tap_error=" + name + ":" + str(e))',
            'if not opened:',
            '    print("store_opened=false")',
            'la.sleep(2)',
            'xml = device.dump_hierarchy()',
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
            'xml = device.dump_hierarchy()',
            'texts = re.findall(r\'(?:text|content-desc)="([^"]+)"\', xml)',
            'for item in texts:',
            '    item = item.strip()',
            '    if item:',
            '        print("icon_text=" + item)',
            'try:',
            '    print("gallery_tap=" + str(device.tap_text("相册", timeout=3)))',
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
            '',
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
            '',
            'device.home()',
            'apps = device.app_list()',
            'print("app_count=" + str(len(apps)))',
            'for pkg in apps[:50]:',
            '    print("app_pkg=" + str(pkg))',
            ...(hasGallery
                ? [
                      'try:',
                      '    print("gallery_tap=" + str(device.tap_text("相册", timeout=3)))',
                      'except Exception as e:',
                      '    print("gallery_tap_error=" + str(e))',
                  ]
                : [
                      'try:',
                      '    print("settings_tap=" + str(device.tap_text("设置", timeout=3)))',
                      'except Exception as e:',
                      '    print("settings_tap_error=" + str(e))',
                  ]),
        ].join('\n')
    }
    return ''
}

const getXmlInfo = async () => {
    if (!props.selectedDeviceId) {
        return ''
    }
    try {
        return await collectDeviceXmlByLa(props.selectedDeviceId)
    } catch {
        return ''
    }
}

const getScreenshot = async () => {
    if (!props.selectedDeviceId) {
        return ''
    }
    try {
        const image = await collectDeviceScreenshotByLa(props.selectedDeviceId)
        return image ? `data:image/png;base64,${image}` : ''
    } catch {
        return ''
    }
}

const buildUserContent = (text: string, xmlInfo: string, screenshot: string) => {
    const content: any[] = [
        {
            type: 'text',
            text: [
                `用户需求：${text}`,
                '',
                '=== 当前任务代码（必须基于此修改，不是重写） ===',
                '```python',
                props.currentCode,
                '```',
                '',
                '=== LinkAndroid API 参考 ===',
                LINKANDROID_TASK_API_PROMPT,
                '',
                '=== 当前界面 XML ===',
                '```xml',
                xmlInfo || '未获取到 XML 信息',
                '```',
                '',
                '=== 开发约束 ===',
                '用户需求可能是自然表达，你需要自行推导合适的 la API、界面观察步骤和输出内容。',
                '不要要求用户提供 API 名称、输出格式或测试标记。',
            ].join('\n'),
        },
    ]
    if (screenshot) {
        content.push({
            type: 'image_url',
            image_url: {
                url: screenshot,
            },
        })
        content.push({
            type: 'text',
            text: [
                '最终确认：上面的截图只用于辅助定位，不是任务目标。',
                '如果截图/XML 与用户需求冲突，以用户需求为准；如果需求涉及当前界面，请用工具继续观察，不要臆测。',
            ].join('\n'),
        })
    }
    return content
}

const pythonString = (value: string) => {
    return value.replace(/\\/g, '\\\\').replace(/'''/g, "\\'\\'\\'")
}

const buildDeviceContextScript = (prompt: string, xmlInfo: string, hasScreenshot: boolean) => {
    const xmlPreview = xmlInfo.slice(0, 1200)
    return [
        'import re',
        'import tempfile',
        'import la',
        '',
        'device = la.device()',
        '',
        `user_requirement = '''${pythonString(prompt)}'''`,
        `SCREENSHOT_INCLUDED = ${hasScreenshot ? 'True' : 'False'}`,
        `XML_PREVIEW = '''${pythonString(xmlPreview)}'''`,
        '',
        'device.screen_on()',
        'device.home()',
        'xml = device.dump_hierarchy()',
        'shot_path = tempfile.mktemp(suffix=".png")',
        'device.screenshot(shot_path)',
        'print("xml automation context ok")',
        'print("device=" + device.serial())',
        'print("xml_length=" + str(len(xml)))',
        'print("screenshot_in_prompt=" + str(SCREENSHOT_INCLUDED))',
        'match = re.search(r\'(?:text|content-desc)="([^"]+)"[^>]*bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"\', xml)',
        'if match:',
        '    label = match.group(1)',
        '    x = (int(match.group(2)) + int(match.group(4))) // 2',
        '    y = (int(match.group(3)) + int(match.group(5))) // 2',
        '    print("first_target=" + label + "@" + str(x) + "," + str(y))',
        'else:',
        '    print("first_target=none")',
    ].join('\n')
}

const formatUiTargets = (targets: any[]) => {
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

const doSend = async () => {
    await sendPrompt(inputText.value)
}

const sendPrompt = async (input: string, displayInput?: string) => {
    const text = input.trim()
    if (!text || loading.value) return
    inputText.value = ''
    addMessage('user', displayInput?.trim() || text)
    scrollToBottom()

    const [providerId, modelId] = (selectedModel.value || '|').split('|')
    if (!providerId || !modelId) {
        addMessage('assistant', t('hint.selectModel'))
        scrollToBottom()
        return
    }
    if (!props.selectedDeviceId) {
        addMessage('assistant', t('hint.selectDeviceFirst'))
        scrollToBottom()
        return
    }
    const provider = modelStore.providers.find((p) => p.id === providerId)
    if (providerId === 'buildIn' && !provider?.apiUrl) {
        addMessage('assistant', t('error.energyInsufficient'))
        scrollToBottom()
        return
    }

    loading.value = true
    const startedAt = Date.now()
    try {
        debugLog('ContextStart', {providerId, modelId, promptLength: text.length})
        const xmlInfo = await getXmlInfo()
        debugLog('XmlReady', {xmlLength: xmlInfo.length, duration: Date.now() - startedAt})
        const screenshot = await getScreenshot()
        debugLog('ScreenshotReady', {hasScreenshot: !!screenshot, duration: Date.now() - startedAt})
        const result = await runTaskCodeAgentCore({
            providerId,
            modelId,
            requirement: text,
            currentCode: props.currentCode,
            xmlInfo,
            screenshot,
            selectedDeviceId: props.selectedDeviceId,
            chat: (pid, mid, input, options, runtimeOptions) =>
                modelStore.chat(pid, mid, input, options, runtimeOptions),
            collectXml: collectDeviceXmlByLa,
            collectScreenshot: collectDeviceScreenshotByLa,
            runPython: runTaskPythonCode,
            updateReadyMessage: t('task.updateToolReady'),
        })
        debugLog('AgentResult', {
            ok: result.ok,
            msg: result.message,
            requestId: result.requestId,
            duration: Date.now() - startedAt,
        })
        if (result.ask) {
            const options = (result.ask.options || [])
                .map((item) => item.trim())
                .filter((item) => item && item !== '自己填')
            addMessage('assistant', '需要补充信息', {
                question: result.ask.question,
                options,
                choice: options[0] || customAskChoice,
                custom: '',
                answered: '',
                sourcePrompt: text,
            })
        } else if (result.ok && result.code) {
            updatePreviewDialog.value?.show(props.currentCode, result.code)
            addMessage('assistant', result.message || t('task.updateToolReady'))
        } else {
            addMessage('assistant', result.message || t('task.noUpdateToolCall'))
        }
    } catch (e: any) {
        debugLog('Error', {message: e.message || `${e}`, duration: Date.now() - startedAt})
        addMessage('assistant', `Error: ${e.message || e}`)
    } finally {
        loading.value = false
        scrollToBottom()
    }
}

const doNewSession = () => {
    messages.value = []
    inputText.value = ''
    Dialog.tipSuccess(t('task.chatNewSessionDone'))
}

const doSubmitAsk = async (msg: ChatMessage) => {
    if (!msg.ask) return
    const answer = msg.ask.choice === customAskChoice ? msg.ask.custom.trim() : msg.ask.choice.trim()
    if (!answer || loading.value) return
    msg.ask.answered = answer
    const prompt = [msg.ask.sourcePrompt, '', `用户针对问题「${msg.ask.question}」选择：${answer}`]
        .filter((item) => item)
        .join('\n')
    await sendPrompt(prompt, answer)
}

const doSaveSessionLog = async () => {
    const data = {
        timestamp: new Date().toISOString(),
        messageCount: messages.value.length,
        messages: messages.value.map((m) => ({
            role: m.role,
            content: m.content,
            timestamp: m.timestamp,
        })),
    }
    try {
        const filePath = await window.$mapi.file.temp('json', 'chat-session-')
        await window.$mapi.file.write(filePath, JSON.stringify(data, null, 2), {isDataPath: false})
        await window.$mapi.app.setClipboardText(filePath)
        Dialog.tipSuccess(t('task.chatLogPathCopied'))
    } catch (e: any) {
        Dialog.tipError(`保存会话日志失败: ${e.message || e}`)
    }
}

defineExpose({
    testSetCode: (code: string) => {
        addMessage('assistant', code)
    },
    testPreviewUpdate: (code: string) => {
        updatePreviewDialog.value?.show(props.currentCode, code)
    },
    testGenerateFromDeviceContext: async (prompt: string) => {
        if (!props.selectedDeviceId) {
            throw new Error(t('hint.selectDeviceFirst'))
        }
        const xmlInfo = await getXmlInfo()
        const screenshot = await getScreenshot()
        if (!xmlInfo) {
            throw new Error(t('device.preview.noXmlInfo'))
        }
        if (!screenshot) {
            throw new Error(t('device.preview.noScreenshot'))
        }
        const code = buildDeviceContextScript(prompt, xmlInfo, !!screenshot)
        updatePreviewDialog.value?.show(props.currentCode, code)
        addMessage('assistant', t('device.preview.acquiredXmlScreenshot', {length: xmlInfo.length}))
    },
    testSendPromptByRealModel: async (payload: string | {prompt: string; model?: string}) => {
        const prompt = typeof payload === 'string' ? payload : payload.prompt
        const model = typeof payload === 'string' ? 'llmpx/default' : payload.model || 'llmpx/default'
        const targetModel = resolveTestModelValue(model)
        if (targetModel) {
            selectedModel.value = targetModel.value
        } else {
            throw new Error(`未配置指定模型：${model}`)
        }
        if (!selectedModel.value) {
            throw new Error(t('task.noVisionToolsModel'))
        }
        await sendPrompt(prompt)
    },
    testAssertRealModel: (model: string = 'llmpx/default') => {
        const targetModel = resolveTestModelValue(model)
        if (!targetModel) {
            throw new Error(`未配置指定模型：${model}`)
        }
        return targetModel.value
    },
    clearMessages: () => {
        messages.value = []
    },
    doNewSession,
    doSaveSessionLog,
})

const onPreviewConfirm = (code: string) => {
    emit('updateCode', code)
    Dialog.tipSuccess(t('task.updateApplied'))
}
</script>

<template>
    <div class="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
        <div ref="messageContainer" class="flex-1 overflow-y-auto px-3 py-3 space-y-3">
            <div
                v-if="messages.length === 0"
                class="flex flex-col items-center justify-center h-full text-center text-gray-400 dark:text-gray-500 select-none"
            >
                <i-lucide-bot class="text-5xl mb-3 opacity-30" />
                <div class="text-sm">{{ $t('task.chatPlaceholder') }}</div>
            </div>

            <div
                v-for="msg in messages"
                :key="msg.id"
                class="flex"
                :class="msg.role === 'user' ? 'justify-end' : 'justify-start'"
            >
                <div
                    class="max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words"
                    :class="
                        msg.role === 'user'
                            ? 'bg-[var(--color-primary)] text-white rounded-br-none'
                            : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-100 dark:border-gray-700 rounded-bl-none'
                    "
                >
                    <div v-if="msg.content">{{ msg.content }}</div>
                    <div
                        v-if="msg.ask"
                        class="mt-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3 whitespace-normal"
                    >
                        <div v-if="msg.ask.answered" class="space-y-2">
                            <div class="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                                <i-lucide-check class="w-4 h-4" aria-hidden="true" />
                                <span class="font-medium">已回答</span>
                            </div>
                            <div class="text-gray-800 dark:text-gray-100 whitespace-pre-wrap">
                                {{ msg.ask.question }}
                            </div>
                            <div
                                class="pl-3 border-l-2 border-[rgb(var(--primary-5))] text-gray-600 dark:text-gray-300 whitespace-pre-wrap"
                            >
                                {{ msg.ask.answered }}
                            </div>
                        </div>
                        <div v-else class="space-y-3">
                            <div class="font-medium text-gray-800 dark:text-gray-100 whitespace-pre-wrap">
                                {{ msg.ask.question }}
                            </div>
                            <div class="space-y-2">
                                <button
                                    v-for="(item, index) in msg.ask.options"
                                    :key="item"
                                    class="w-full flex items-start gap-3 p-2 rounded-lg border text-left transition-all"
                                    :class="
                                        msg.ask.choice === item
                                            ? 'border-[rgb(var(--primary-5))] bg-blue-50 dark:bg-blue-900/30'
                                            : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-[rgb(var(--primary-5))]'
                                    "
                                    @click="msg.ask.choice = item"
                                >
                                    <span
                                        class="shrink-0 w-5 h-5 rounded-full border flex items-center justify-center text-xs"
                                        :class="
                                            msg.ask.choice === item
                                                ? 'border-[rgb(var(--primary-5))] bg-[var(--color-primary)] text-white'
                                                : 'border-gray-300 dark:border-gray-500 text-gray-500'
                                        "
                                    >
                                        {{ index + 1 }}
                                    </span>
                                    <span class="flex-1 text-gray-700 dark:text-gray-200">{{ item }}</span>
                                    <i-lucide-check
                                        v-if="msg.ask.choice === item"
                                        class="w-4 h-4 text-[var(--color-primary)] shrink-0"
                                        aria-hidden="true"
                                    />
                                </button>
                                <div
                                    class="flex items-start gap-3 p-2 rounded-lg border transition-all"
                                    :class="
                                        msg.ask.choice === customAskChoice
                                            ? 'border-[rgb(var(--primary-5))] bg-blue-50 dark:bg-blue-900/30'
                                            : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800'
                                    "
                                >
                                    <button
                                        class="shrink-0 w-5 h-5 rounded-full border flex items-center justify-center text-xs"
                                        :class="
                                            msg.ask.choice === customAskChoice
                                                ? 'border-[rgb(var(--primary-5))] bg-[var(--color-primary)] text-white'
                                                : 'border-gray-300 dark:border-gray-500 text-gray-500'
                                        "
                                        @click="msg.ask.choice = customAskChoice"
                                    >
                                        <i-lucide-edit-3 class="w-3 h-3" aria-hidden="true" />
                                    </button>
                                    <a-textarea
                                        v-model="msg.ask.custom"
                                        placeholder="自己填"
                                        class="flex-1"
                                        :auto-size="{minRows: 1, maxRows: 6}"
                                        @focus="msg.ask.choice = customAskChoice"
                                        @input="msg.ask.choice = customAskChoice"
                                    />
                                </div>
                            </div>
                            <a-button
                                type="primary"
                                long
                                :loading="loading"
                                :disabled="
                                    msg.ask.choice === customAskChoice ? !msg.ask.custom.trim() : !msg.ask.choice
                                "
                                @click="doSubmitAsk(msg)"
                            >
                                提交答案
                            </a-button>
                        </div>
                    </div>
                </div>
            </div>

            <div v-if="loading" class="flex justify-start">
                <div
                    class="max-w-[85%] rounded-xl px-3 py-2 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-bl-none flex items-center gap-2"
                >
                    <span class="relative flex h-2 w-2">
                        <span
                            class="animate-ping absolute inline-flex h-full w-full rounded-full bg-[rgb(var(--primary-5))] opacity-75"
                        ></span>
                        <span class="relative inline-flex rounded-full h-2 w-2 bg-[var(--color-primary)]"></span>
                    </span>
                    <span class="text-xs text-gray-400">{{ $t('task.chatGenerating') }}</span>
                </div>
            </div>
        </div>

        <div
            class="shrink-0 px-3 py-2 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 space-y-2"
        >
            <a-textarea
                v-model="inputText"
                :placeholder="$t('task.chatPlaceholder')"
                :auto-size="{minRows: 2, maxRows: 6}"
                class="w-full"
                @keydown.enter.exact.prevent="doSend"
            />
            <div class="flex items-center gap-2">
                <a-select v-model="selectedModel" class="flex-1" :placeholder="$t('model.select')">
                    <template #label>
                        <div class="flex items-center" v-if="selectedOption">
                            <a-avatar
                                :image-url="getModelLogo(selectedOption.modelId)"
                                :size="18"
                                shape="square"
                                class="mr-1 shrink-0"
                                style="border: 1px solid #ccc"
                            />
                            <span class="truncate">{{ selectedOption.label }}</span>
                        </div>
                        <span v-else>{{ $t('model.select') }}</span>
                    </template>
                    <a-option v-for="opt in modelOptions" :key="opt.value" :value="opt.value">
                        <div class="flex items-center gap-1">
                            <a-avatar
                                :image-url="getModelLogo(opt.modelId)"
                                :size="18"
                                shape="square"
                                class="shrink-0"
                                style="border: 1px solid #ccc"
                            />
                            <span class="truncate">{{ opt.label }}</span>
                        </div>
                    </a-option>
                </a-select>
                <a-button type="primary" :loading="loading" @click="doSend" class="shrink-0">
                    <template #icon><i-lucide-message-square /></template>
                    {{ $t('task.chatSend') }}
                </a-button>
                <a-dropdown trigger="click">
                    <a-button class="shrink-0" aria-label="聊天更多操作">
                        <template #icon><i-lucide-ellipsis-vertical /></template>
                    </a-button>
                    <template #content>
                        <a-doption @click="doNewSession">
                            <template #icon><i-lucide-plus /></template>
                            {{ $t('task.chatNewSession') }}
                        </a-doption>
                        <a-doption @click="doSaveSessionLog">
                            <template #icon><i-lucide-file-text /></template>
                            {{ $t('task.chatSessionLog') }}
                        </a-doption>
                    </template>
                </a-dropdown>
            </div>
        </div>
        <TaskUpdatePreviewDialog ref="updatePreviewDialog" @confirm="onPreviewConfirm" />
    </div>
</template>
