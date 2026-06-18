# la 库 — LinkAndroid 自动化接口文档

`la` 是 LinkAndroid 内置的 Python 自动化库，基于 `uiautomator2` 封装，用于在任务中控制 Android 设备。

所有 API 通过 `la.xxx()` 或 `device.xxx()`（单设备代理）方式调用。

---

## 快速开始

```python
import la

# 获取单设备（推荐方式）
device = la.device()

# 设备基本信息
print("设备: " + device.serial())
print(f"屏幕: {device.width()}x{device.height()}")

# 常用操作
device.home()                                  # 返回桌面
device.appStart("com.android.settings")       # 打开设置
la.sleep(2)                                    # 等待 2 秒
device.screenshot("settings.png")              # 截屏
```

---

## 环境变量

任务运行时会自动注入以下环境变量：

| 变量名 | 说明 |
|--------|------|
| `LINKANDROID_DEVICE_ID` | 当前选中的设备 ID |
| `LINKANDROID_DEVICE_IDS` | 所有运行设备 ID 列表（逗号分隔） |
| `LINKANDROID_ADB_PATH` | ADB 可执行文件路径 |
| `LINKANDROID_TASK_ID` | 当前任务 ID |
| `LINKANDROID_TASK_NAME` | 当前任务名称 |
| `ANDROID_DEVICE_ADDR` | 设备地址，可覆盖 `la.connect()` 的默认地址 |

---

## 连接管理

设备连接 API，用于获取设备实例和底层控制。

### connect(addr, serial)

**功能**：连接到 Android 设备。

**参数**：

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `addr` | str | `"127.0.0.1"` | 设备地址，支持 `IP:PORT` 或 serial。可通过环境变量 `ANDROID_DEVICE_ADDR` 覆盖默认值 |

**返回值**：`uiautomator2.Device` 实例

**示例**：
```python
import la

# 默认连接
la.connect()

# 指定设备
la.connect("192.168.1.100:5555")
la.connect("emulator-5554")
```

---

### device()

**功能**：获取单设备代理。调试运行时为调试设备，正式运行时为第一个运行设备。**新任务推荐默认使用此方式**。

**参数**：无

**返回值**：`DeviceProxy` 对象，支持所有 `la` 模块级 API 方法

**示例**：
```python
import la
device = la.device()
device.home()
device.click(500, 1000)
print("设备: " + device.serial())
```

---

### devices()

**功能**：获取所有运行设备的设备集合。

**参数**：无

**返回值**：`Devices` 对象，包含：

| 属性/方法 | 说明 |
|-----------|------|
| `.ids` | 所有设备 ID 列表 |
| `[index]` | 索引访问单台设备代理 |
| 直接调用 `.xxx()` | 等价操作第一台设备 |
| `len(devices)` | 设备数量 |

**示例**：
```python
import la
devices = la.devices()
print("设备数量:", len(devices))
print("设备列表:", ",".join(devices.ids))
```

---

### raw()

**功能**：获取 `uiautomator2` 原生 Device 实例，用于高级操作。

**参数**：无

**返回值**：`uiautomator2.Device` 实例

**示例**：
```python
import la
d = la.raw()
d(text="设置").click()
print(d.appCurrent())
```

---

### u2

**功能**：`uiautomator2` 模块本身，用于高级导入场景。

**类型**：模块对象

**示例**：
```python
import la
print(la.u2.__name__)  # 输出: uiautomator2
```

---

### disconnect()

**功能**：断开当前连接，重置全局设备实例。

**参数**：无

**返回值**：无

---

## 单设备与多设备

**推荐模式**：新任务默认使用 `device = la.device()` 编写单设备逻辑。

**多设备场景**：先获取 `devices = la.devices()`，然后：

1. **显式同步**：使用 `la.multi.xxx(devices, ...)` 对所有设备执行相同操作
2. **逐台处理**：使用 `for ds in devices:` 循环逐台操作

`la.multi.xxx(devices, ...)` 返回每台设备的执行结果列表。

```python
import la

device = la.device()               # 单设备
device.home()

devices = la.devices()             # 多设备
print("devices=" + ",".join(devices.ids))

# 多设备同步操作
la.multi.screenOn(devices)
la.multi.home(devices)
la.multi.click(devices, 500, 1000)

# 逐台条件处理
for ds in devices:
    if ds.serial() == "a":
        ds.click(100, 200)
    else:
        ds.home()
```

---

## 工具与网络

### util.sleep(seconds)

**功能**：等待指定秒数。

**参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| `seconds` | int/float | 等待秒数，支持小数 |

**别名**：`la.sleep(seconds)`

**示例**：
```python
la.util.sleep(2.5)   # 等待 2.5 秒
la.sleep(1)          # 等价写法
```

---

### util.now()

**功能**：获取当前时间的 ISO 格式字符串。

**参数**：无

**返回值**：str，如 `"2025-06-15T10:30:00.000000"`

**示例**：
```python
now = la.util.now()
print("当前时间:", now)
```

---

### util.jsonLoads(text)

**功能**：JSON 字符串转 Python 对象。

**参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| `text` | str | JSON 格式字符串 |

**返回值**：Python 对象（dict / list / str / int 等）

**示例**：
```python
data = la.util.jsonLoads('{"ok": true, "count": 42}')
print(data["ok"])     # True
print(data["count"])  # 42
```

---

### util.jsonDumps(data)

**功能**：Python 对象转 JSON 字符串。

**参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| `data` | any | 可序列化的 Python 对象 |

**返回值**：str

**示例**：
```python
text = la.util.jsonDumps({"name": "test", "value": 123})
print(text)  # {"name": "test", "value": 123}
```

---

### util.retry(callback, times, interval)

**功能**：简单重试机制。

**参数**：

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `callback` | callable | - | 要执行的回调函数 |
| `times` | int | `3` | 最大重试次数 |
| `interval` | int/float | `1` | 重试间隔（秒） |

**返回值**：回调函数的返回值（首次成功时）

**示例**：
```python
result = la.util.retry(lambda: la.find(text="确定"), times=5, interval=2)
```

---

### http.get(url, **kwargs)

**功能**：HTTP GET 请求。

**参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| `url` | str | 请求地址 |
| `**kwargs` | any | 其他 `requests.get()` 参数（headers, timeout 等） |

**返回值**：`requests.Response` 对象

**示例**：
```python
resp = la.http.get("https://httpbin.org/get", timeout=5)
print(resp.status_code)
```

---

### http.post(url, **kwargs)

**功能**：HTTP POST 请求。

**参数**：同 `http.get()`，但使用 POST 方法。

**示例**：
```python
resp = la.http.post("https://httpbin.org/post",
                     json={"key": "value"}, timeout=5)
```

---

### http.request(method, url, **kwargs)

**功能**：通用 HTTP 请求。

**参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| `method` | str | HTTP 方法（GET/POST/PUT/DELETE 等） |
| `url` | str | 请求地址 |
| `**kwargs` | any | 其他 `requests.request()` 参数 |

**返回值**：`requests.Response` 对象

---

### http.json(method, url, **kwargs)

**功能**：HTTP 请求并直接解析 JSON 响应。

**参数**：同 `http.request()`

**返回值**：dict（解析后的 JSON）

**示例**：
```python
data = la.http.json("GET", "https://api.example.com/data")
print(data)
```

---

## 基础点击操作

### click(x, y, timeout)

**功能**：点击屏幕坐标。

**参数**：

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `x` | int | - | 屏幕 x 坐标 |
| `y` | int | - | 屏幕 y 坐标 |
| `timeout` | int/float | `0` | 点击后的等待时间（秒） |

**示例**：
```python
device.click(500, 1000)       # 点击 (500, 1000)
device.click(100, 200, 0.5)   # 点击后等待 0.5 秒
```

---

### tap(x, y, timeout)

**功能**：`click()` 的短别名，语义更接近触摸操作。

**参数**：同 `click()`

**示例**：
```python
device.tap(500, 1000)
```

---

### doubleClick(x, y, duration)

**功能**：双击屏幕坐标。

**参数**：

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `x` | int | - | 屏幕 x 坐标 |
| `y` | int | - | 屏幕 y 坐标 |
| `duration` | float | `0.1` | 两次点击之间的间隔（秒） |

---

### longClick(x, y, duration)

**功能**：长按屏幕坐标。

**参数**：

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `x` | int | - | 屏幕 x 坐标 |
| `y` | int | - | 屏幕 y 坐标 |
| `duration` | float | `0.5` | 按住时长（秒） |

---

## 滑动 & 拖拽

### swipe(fx, fy, tx, ty, duration)

**功能**：从起点滑动到终点。

**参数**：

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `fx` | int | - | 起点 X 坐标 |
| `fy` | int | - | 起点 Y 坐标 |
| `tx` | int | - | 终点 X 坐标 |
| `ty` | int | - | 终点 Y 坐标 |
| `duration` | float | `0.1` | 滑动持续时间（秒） |

**示例**：
```python
device.swipe(200, 800, 200, 400, 0.2)  # 从下往上滑动
```

---

### swipeExt(direction, scale)

**功能**：沿指定方向滑动屏幕。

**参数**：

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `direction` | str | - | 方向：`"left"` / `"right"` / `"up"` / `"down"`（也支持中文 `"左"` `"右"` `"上"` `"下"`） |
| `scale` | float | `0.9` | 滑动距离占屏幕尺寸的比例 |

**示例**：
```python
device.swipeExt("up", 0.5)     # 上滑半个屏幕
device.swipeExt("左")          # 向左滑动
```

---

### swipeTo(direction, text, timeout)

**功能**：滑动直到找到目标文本元素。

**参数**：

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `direction` | str | - | 滑动方向（同 `swipeExt`） |
| `text` | str | `"..."` | 要查找的目标文本 |
| `timeout` | int | `10` | 超时秒数 |

**返回值**：找到的 UI 元素对象，未找到返回 None

**示例**：
```python
elem = device.swipeTo("up", text="下一步", timeout=15)
if elem:
    elem.click()
```

---

### drag(fx, fy, tx, ty, duration)

**功能**：拖拽操作。

**参数**：

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `fx` | int | - | 起点 X 坐标 |
| `fy` | int | - | 起点 Y 坐标 |
| `tx` | int | - | 终点 X 坐标 |
| `ty` | int | - | 终点 Y 坐标 |
| `duration` | float | `0.5` | 拖拽持续时间（秒） |

---

### scrollForward()

**功能**：向前滚动（列表/WebView 向下翻页）。

**参数**：无

**返回值**：bool — 是否还可以继续滚动

**示例**：
```python
while device.scrollForward():
    pass  # 滚动到底部
```

---

### scrollBackward()

**功能**：向后滚动（列表/WebView 向上翻页）。

**参数**：无

**返回值**：bool — 是否还可以继续滚动

---

## 文字输入

### text(text, clear, enter)

**功能**：向当前焦点输入框输入文本。

**参数**：

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `text` | str | - | 要输入的文本内容 |
| `clear` | bool | `False` | 是否先清空输入框 |
| `enter` | bool | `False` | 输入后是否按回车 |

**示例**：
```python
device.text("Hello")                        # 输入文本
device.text("Hello", clear=True)            # 清空后输入
device.text("Hello", enter=True)            # 输入后回车
```

---

### inputText(text, clear, enter)

**功能**：`text()` 的语义化别名，推荐 AI 生成任务使用。

**参数**：同 `text()`

---

### clearText()

**功能**：清空当前焦点输入框的内容。

**参数**：无

---

### sendKeys(text)

**功能**：发送按键序列（同 `text()` 但无额外参数）。

**参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| `text` | str | 要发送的文本 |

---

### typeText(text)

**功能**：`text()` 的别名，语义更清晰。

**参数**：同 `text()`

---

## 截图 & UI 层次

### screenshot(filename, quality)

**功能**：截屏并保存到文件，同时返回图片 bytes。

**参数**：

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `filename` | str | `"screenshot.png"` | 截图保存路径 |
| `quality` | int | `90` | JPEG 压缩质量（1-100） |

**返回值**：bytes（截图的二进制数据）

**示例**：
```python
shot = device.screenshot("shot.png")
print(f"截图大小: {len(shot)} bytes")
```

---

### dumpHierarchy()

**功能**：获取当前界面的 UI 层次 XML 字符串。

**参数**：无

**返回值**：str（XML 格式的 UI 层次结构）

**示例**：
```python
xml = device.dumpHierarchy()
print(f"XML 长度: {len(xml)}")
```

---

### dumpXmlToFile(path)

**功能**：获取 UI 层次 XML 并保存到文件。

**参数**：

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `path` | str | `"ui_hierarchy.xml"` | 保存路径 |

**返回值**：str（XML 内容）

---

## 元素查找

### selector(text, ...)

**功能**：创建 `uiautomator2` 原生选择器对象。

**参数**：支持以下关键字参数（别名自动识别）：

| 参数 | 别名 | 说明 |
|------|------|------|
| `text` | - | 匹配文本 |
| `resourceId` | `id` | 资源 ID |
| `contentDesc` | `desc`/`description` | content-desc 描述 |
| `className` | `class_name` | 类名 |
| `packageName` | `package_name` | 包名 |

**返回值**：`uiautomator2.Selector` 对象

**示例**：
```python
sel = device.selector(text="设置")
sel.click()

device.selector(id="com.android.settings:id/search").click()
```

---

### find(text, className, resourceId, description, packageName, index)

**功能**：查找匹配的第一个 UI 元素。

**参数**：

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `text` | str | `None` | 过滤文本 |
| `className` | str | `None` | 过滤类名 |
| `resourceId` | str | `None` | 过滤资源 ID |
| `description` | str | `None` | 过滤 content-desc |
| `packageName` | str | `None` | 过滤包名 |
| `index` | int | `0` | 匹配元素索引 |

**返回值**：UI 元素对象，未找到时返回 None

**别名**：`findOne()`

**示例**：
```python
elem = device.find(text="确定", className="android.widget.Button")
if elem:
    elem.click()
```

---

### findAll(text, className, resourceId, description, packageName)

**功能**：查找所有匹配的 UI 元素。

**参数**：同 `find()`（不含 `index`）

**返回值**：list — UI 元素对象列表

**示例**：
```python
items = device.findAll(className="android.widget.TextView")
for item in items:
    print(device.getText(item))
```

---

### exists(text, className, resourceId, description, timeout)

**功能**：判断元素是否存在。

**参数**：

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| 选择器参数 | str | `None` | 同 `find()` 的选择器参数 |
| `timeout` | int/float | `0` | 等待超时（秒），>0 时等待元素出现 |

**返回值**：bool

**示例**：
```python
if device.exists(text="确定", timeout=3):
    print("元素已出现")
```

---

### count(text, className, resourceId, description)

**功能**：统计匹配的元素数量。

**参数**：同 `find()` 的选择器参数

**返回值**：int

---

### wait(text, className, resourceId, description, timeout)

**功能**：等待元素出现；未传选择器时等待设备空闲。

**参数**：

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| 选择器参数 | str | `None` | 要等待的元素的筛选条件 |
| `timeout` | int/float | `10` | 等待超时（秒）。未传选择器时默认 `5` |

**返回值**：bool（元素是否在超时前出现）

**示例**：
```python
# 等待设备空闲
device.wait()

# 等待元素出现
if device.wait(text="设置", timeout=5):
    print("设置元素已出现")
```

---

### clickText(text, timeout)

**功能**：点击包含指定文本的控件。

**参数**：

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `text` | str | - | 目标文本 |
| `timeout` | int/float | `5` | 等待超时（秒） |

---

### tapText(text, timeout)

**功能**：点击指定文本控件。推荐 AI 生成任务使用。

**参数**：同 `clickText()`

---

### tapDesc(description, timeout)

**功能**：点击指定 content-desc 描述的控件。

**参数**：

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `description` | str | - | content-desc 描述内容 |
| `timeout` | int/float | `5` | 等待超时（秒） |

---

### tapId(resourceId, timeout)

**功能**：点击指定 resource-id 的控件。

**参数**：

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `resourceId` | str | - | 资源 ID |
| `timeout` | int/float | `5` | 等待超时（秒） |

---

### tapExists(timeout, **selector)

**功能**：元素存在则点击。

**参数**：

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `timeout` | int/float | `5` | 等待超时（秒） |
| `**selector` | str | - | 选择器参数（text/id/desc/class_name 等） |

**返回值**：bool — 是否已点击

**别名**：`clickIfExists()`

**示例**：
```python
if device.tapExists(text="允许", timeout=3):
    print("已处理权限弹窗")
```

---

### findByXpath(xpath)

**功能**：通过 XPath 查找 UI 元素。

**参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| `xpath` | str | XPath 表达式 |

**返回值**：UI 元素对象或列表

**示例**：
```python
elem = device.findByXpath("//android.widget.TextView[@text='设置']")
```

---

## 元素交互

### clickElement(element)

**功能**：点击已获取的 UI 元素对象。

**参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| `element` | UIElement | 已查找到的 UI 元素 |

**示例**：
```python
elem = device.find(text="确定")
if elem:
    device.clickElement(elem)
```

---

### clickCenter(element)

**功能**：点击 UI 元素的中心点。

**参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| `element` | UIElement | 已查找到的 UI 元素 |

---

### getText(element)

**功能**：获取 UI 元素的文本内容。

**参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| `element` | UIElement | 已查找到的 UI 元素 |

**返回值**：str — 元素的文本内容

**示例**：
```python
elem = device.find(className="android.widget.TextView")
text = device.getText(elem)
print("元素文本:", text)
```

---

### getBounds(element)

**功能**：获取 UI 元素的边界坐标。

**参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| `element` | UIElement | 已查找到的 UI 元素 |

**返回值**：dict — `{"left": int, "top": int, "right": int, "bottom": int}`

**示例**：
```python
bounds = device.getBounds(elem)
print(f"位置: {bounds}")
```

---

### center(element)

**功能**：获取 UI 元素的中心点坐标。

**参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| `element` | UIElement | 已查找到的 UI 元素 |

**返回值**：tuple — `(x, y)` 中心点坐标

---

### info(element)

**功能**：获取 UI 元素的原始 `info` 属性字典。

**参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| `element` | UIElement | 已查找到的 UI 元素 |

**返回值**：dict — 包含元素的所有属性（text, content-desc, bounds, className, packageName 等）

---

## 应用管理

### appStart(package_name, activity)

**功能**：启动应用。

**参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| `package_name` | str | 应用包名 |
| `activity` | str | `None` | 可选，指定 Activity |

**示例**：
```python
device.appStart("com.android.settings")
```

---

### appStop(package_name)

**功能**：停止指定应用。

**参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| `package_name` | str | 应用包名 |

---

### appClear(package_name)

**功能**：清除应用数据（相当于「设置→应用→清除数据」）。

**参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| `package_name` | str | 应用包名 |

---

### appCurrent()

**功能**：获取当前前台应用信息。

**参数**：无

**返回值**：dict — `{"package": str, "activity": str}`

**示例**：
```python
info = device.appCurrent()
print(f"当前应用: {info['package']}")
print(f"当前 Activity: {info['activity']}")
```

---

### appList()

**功能**：列出正在运行的应用包名列表。

**参数**：无

**返回值**：list[str] — 运行中的包名列表

**示例**：
```python
apps = device.appList()
for app in apps:
    print("运行中:", app)
```

---

### appInstall(url_or_path)

**功能**：安装 APK。支持本地文件路径和远程 URL。

**参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| `url_or_path` | str | APK 文件路径或下载 URL |

---

### appUninstall(package_name)

**功能**：卸载指定应用。

**参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| `package_name` | str | 应用包名 |

---

### currentPackage()

**功能**：获取当前前台应用的包名。

**参数**：无

**返回值**：str — 包名

**示例**：
```python
pkg = device.currentPackage()
print("当前包名:", pkg)
```

---

### currentActivity()

**功能**：获取当前前台 Activity 名称。

**参数**：无

**返回值**：str — Activity 全名

**示例**：
```python
activity = device.currentActivity()
print("当前 Activity:", activity)
```

---

## 按键事件

### press(key)

**功能**：模拟按键。

**参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| `key` | str | 按键名称，支持：`home`, `back`, `menu`, `recent`, `power`, `volume_up`, `volume_down`, `enter`, `delete`, `search`, `camera`, `settings` 等 |

**示例**：
```python
device.press("home")
device.press("volume_up")
device.press("enter")
```

---

### home()

**功能**：按 HOME 键（返回桌面）。

**参数**：无

---

### back()

**功能**：按返回键。

**参数**：无

---

### menu()

**功能**：按菜单键。

**参数**：无

---

### recent()

**功能**：显示最近任务。

**参数**：无

---

### power()

**功能**：按电源键。

**参数**：无

---

### pressHome()

**功能**：按 HOME 键的别名函数。

### pressBack()

**功能**：按返回键的别名函数。

### pressMenu()

**功能**：按菜单键的别名函数。

### pressRecent()

**功能**：显示最近任务的别名函数。

### pressPower()

**功能**：按电源键的别名函数。

### pressEnter()

**功能**：按回车键的别名函数。

### pressDel()

**功能**：按删除键的别名函数。

---

## 屏幕信息

### width()

**功能**：获取屏幕宽度（像素）。

**参数**：无

**返回值**：int

---

### height()

**功能**：获取屏幕高度（像素）。

**参数**：无

**返回值**：int

---

### size()

**功能**：获取屏幕尺寸。

**参数**：无

**返回值**：tuple — `(width, height)`

**示例**：
```python
w, h = device.size()
print(f"屏幕分辨率: {w}x{h}")
```

---

### isScreenOn()

**功能**：判断屏幕是否亮着。

**参数**：无

**返回值**：bool

---

### screenOn()

**功能**：点亮屏幕。

**参数**：无

---

### screenOff()

**功能**：熄灭屏幕。

**参数**：无

---

### unlock()

**功能**：解锁屏幕（滑动解锁）。

**参数**：无

**说明**：仅执行滑动解锁操作，如需密码还需额外处理。

---

## 设备信息

### deviceInfo()

**功能**：获取完整的设备信息字典。

**参数**：无

**返回值**：dict — 包含设备品牌、型号、Android 版本、屏幕信息等

---

### serial()

**功能**：获取设备序列号。

**参数**：无

**返回值**：str

---

### wlanIp()

**功能**：获取设备 WLAN IP 地址。

**参数**：无

**返回值**：str

**示例**：
```python
ip = device.wlanIp()
print("设备 IP:", ip)
```

---

### battery()

**功能**：获取电池信息。

**参数**：无

**返回值**：dict — 包含 `level`（电量百分比）、`temperature`、`status` 等

**示例**：
```python
battery = device.battery()
print(f"电量: {battery['level']}%")
print(f"温度: {battery['temperature']}")
```

---

### memoryInfo()

**功能**：获取设备内存信息。

**参数**：无

**返回值**：dict — 包含 `total`、`available` 等内存信息

---

### cpuInfo()

**功能**：获取设备 CPU 信息。

**参数**：无

**返回值**：dict — 包含 CPU 架构、核心数等信息

---

## 通知 & 快捷设置

### openNotification()

**功能**：打开通知栏。

**参数**：无

---

### openQuickSettings()

**功能**：打开快捷设置面板。

**参数**：无

---

## 剪贴板

### setClipboard(text)

**功能**：设置设备剪贴板内容。

**参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| `text` | str | 要设置的文本 |

---

### getClipboard()

**功能**：获取设备剪贴板内容。

**参数**：无

**返回值**：str — 剪贴板文本

**示例**：
```python
text = device.getClipboard()
print("剪贴板:", text)
```

---

## 屏幕录制

### startScreenRecord(path)

**功能**：开始屏幕录制（保存到设备本地）。

**参数**：

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `path` | str | `"/sdcard/screen_record.mp4"` | 录制文件保存路径 |

---

### stopScreenRecord()

**功能**：停止屏幕录制。

**参数**：无

**返回值**：录制文件的信息（具体格式依赖于底层实现）

---

## 实用工具

### openUrl(url)

**功能**：通过系统浏览器打开 URL。

**参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| `url` | str | 要打开的网址 |

---

### toast(message, duration)

**功能**：在设备上显示 Toast 消息。

**参数**：

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `message` | str | - | 消息内容 |
| `duration` | float | `1.0` | 显示时长（秒） |

---

### setFastInputIme(enable)

**功能**：启用/关闭快速输入法（绕过输入法直接填充文字，可大幅提升输入速度）。

**参数**：

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `enable` | bool | `True` | 是否启用快速输入法 |

---

## 等待 & 休眠

### sleep(seconds)

**功能**：休眠指定秒数（`util.sleep` 的别名）。

**参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| `seconds` | int/float | 休眠秒数，支持小数 |

**示例**：
```python
la.sleep(1.5)    # 休眠 1.5 秒
```

---

### waitIdle(timeout)

**功能**：等待设备空闲（无动画、无加载）。

**参数**：

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `timeout` | int/float | `5` | 超时秒数 |

**返回值**：bool — 设备是否在超时前空闲

---

### waitActivity(activity, timeout)

**功能**：等待指定 Activity 出现（支持正则匹配）。

**参数**：

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `activity` | str | - | Activity 名称或正则表达式 |
| `timeout` | int | `10` | 超时秒数 |

**返回值**：bool — Activity 是否在超时前出现

**示例**：
```python
if device.waitActivity(r"\.Settings", timeout=5):
    print("已进入设置界面")
```

---

### waitUntil(condition, timeout, interval)

**功能**：等待自定义条件成立。

**参数**：

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `condition` | callable | - | 返回 bool 的回调函数 |
| `timeout` | int/float | `10` | 超时秒数 |
| `interval` | float | `0.5` | 轮询间隔（秒） |

**返回值**：bool — 条件是否在超时前成立

**示例**：
```python
device.waitUntil(lambda: device.exists(text="确定"), timeout=10)
```

---

### waitUntilGone(text, className, resourceId, description, timeout)

**功能**：等待元素消失。

**参数**：

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| 选择器参数 | str | `None` | 同 `find()` 的选择器参数 |
| `timeout` | int/float | `10` | 超时秒数 |

**返回值**：bool — 元素是否在超时前消失

**示例**：
```python
device.waitUntilGone(text="加载中", timeout=10)
```

---

### error

**功能**：通用异常别名，可用于 `except` 语句。

**类型**：`Exception` 类

**示例**：
```python
try:
    device.click(100, 200)
except la.error as e:
    print(f"自动化出错: {e}")
```

---

## 预置可用库

任务环境中已预装以下 Python 库，无需额外安装即可直接使用：

| 模块 | 说明 |
|------|------|
| `requests` | HTTP 请求库 |
| `PIL (Pillow)` | 图片处理库 |
| `json` | JSON 编解码 |
| `re` | 正则表达式 |
| `math` | 数学运算 |
| `random` | 随机数 |
| `datetime` | 日期时间 |
| `pathlib.Path` | 路径操作 |
| `os` / `sys` / `time` / `subprocess` | 标准系统库 |

这些库也可以通过 `la.json`、`la.re`、`la.math`、`la.random`、`la.Path`、`la.datetime` 的方式从 la 模块访问。

---

## 完整示例

```python
import la
import requests
from pathlib import Path

# 获取单设备
device = la.device()
print("设备: " + device.serial())

# 返回桌面
device.home()
la.sleep(1)

# 打开设置应用
device.appStart("com.android.settings")

# 等待元素出现
if device.wait(text="设置", timeout=5):
    # 上滑
    device.swipeExt("up", scale=0.5)
    la.sleep(1)

    # 截图
    shot = device.screenshot("settings.png")
    print(f"截图大小: {len(shot)} bytes")

    # 获取 UI 层次
    xml = device.dumpHierarchy()
    print(f"XML 长度: {len(xml)}")

# 获取电池信息
battery = device.battery()
print(f"电量: {battery['level']}%")

# 回到桌面
device.home()

# HTTP 请求上报设备信息
resp = requests.post(
    "https://httpbin.org/post",
    json={"device": device.serial(), "battery": battery["level"]},
    timeout=5,
)
print(f"上报结果: {resp.status_code}")

print("示例结束")
```
