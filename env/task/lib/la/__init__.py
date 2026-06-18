"""
la.py — LinkAndroid UI Automator 2 便捷封装 (开发文档库)

快速开始:
    import la
    device = la.device()        # 调试时为当前调试设备, 运行时为第一个运行设备
    device.click(500, 1000)     # 点击坐标
    device.tapText("设置")      # 点击文本
    devices = la.devices()      # 设备集合, 可循环或交给 la.multi 批量操作
    la.multi.click(devices, 500, 1000)
    d = la.raw()                 # 获取 uiautomator2 原生 Device
    d(text="设置").click()       # 直接使用 uiautomator2 API
    la.swipe(100, 500, 900, 500)  # 滑动
    la.home()                   # 按 HOME 键
    la.screenshot(\'shot.png\')   # 截屏

环境变量:
    LINKANDROID_DEVICE_ID       - 当前选中的设备 ID (由 LinkAndroid 注入)
    LINKANDROID_DEVICE_IDS      - 当前运行的设备 ID 列表, 逗号分隔或 JSON 数组
    LINKANDROID_SCRIPT_ID       - 当前运行的脚本 ID (由 LinkAndroid 注入)
    LINKANDROID_SCRIPT_NAME     - 当前运行的脚本名称 (由 LinkAndroid 注入)
    LINKANDROID_ADB_PATH        - ADB 可执行文件路径 (由 LinkAndroid 注入)
    ANDROID_DEVICE_ADDR         - 设备地址, 可覆盖 la.connect() 默认地址

预置可用库 (无需额外安装):
    json, re, math, random, datetime, pathlib.Path, os, sys, time, subprocess
    requests                    - HTTP 请求库
    PIL (Pillow)                - 图片处理库

依赖: uiautomator2 (安装在 _aienv 虚拟环境中), 可通过 la.u2 或 la.raw() 使用原生能力
"""
from __future__ import annotations

import json
import math
import random
import re
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, List, Optional, Tuple

import requests
import uiautomator2 as u2

# ---------------------------------------------------------------------------
# 共享状态
# ---------------------------------------------------------------------------
from ._state import (
    _device,
    error,
    _require_device,
    _split_device_ids,
    _runtime_device_ids,
    _unique_device_ids,
    _connect_raw,
    _active_device_id,
)

# Re-import _state as module for mutation access
from . import _state as _la_state

# ---------------------------------------------------------------------------
# 常用库重导出 (方便用户直接使用)
# ---------------------------------------------------------------------------
# 用法: la.json, la.re, la.math, la.random, la.Path, la.datetime 等
# 无需在脚本顶部额外 import

__all__ = [
    "connect", "device", "raw", "devices", "Device", "DeviceGroup", "multi", "util", "http", "u2", "disconnect",
    "llm",
    "click", "tap", "doubleClick", "longClick",
    "swipe", "swipeExt", "swipeTo",
    "drag", "scrollForward", "scrollBackward",
    "text", "inputText", "clearText", "sendKeys", "typeText",
    "screenshot", "dumpHierarchy", "dumpXmlToFile",
    "selector", "select", "find", "findOne", "findAll", "count", "exists", "wait",
    "tapText", "tapDesc", "tapId", "tapExists", "clickText", "clickIfExists",
    "findByXpath",
    "clickElement", "clickCenter", "getText", "getBounds", "center", "info",
    "appStart", "appStop", "appClear",
    "appCurrent", "appList", "appInstall", "appUninstall",
    "press", "pressHome", "pressBack", "pressMenu",
    "pressRecent", "pressPower", "pressEnter", "pressDel",
    "home", "back", "menu", "recent", "power",
    "width", "height", "size",
    "deviceInfo", "serial", "wlanIp", "battery",
    "currentPackage", "currentActivity",
    "openUrl", "toast", "setFastInputIme",
    "isScreenOn", "screenOn", "screenOff", "unlock",
    "openNotification", "openQuickSettings",
    "setClipboard", "getClipboard",
    "startScreenRecord", "stopScreenRecord",
    "memoryInfo", "cpuInfo",
    "waitActivity", "waitUntil", "waitUntilGone",
    "sleep", "waitIdle",
    # 重导出的标准库
    "json", "re", "math", "random", "Path", "datetime", "timedelta", "requests",
    "error",
]


# ---------------------------------------------------------------------------
# 核心类
# ---------------------------------------------------------------------------

class Device:
    """单设备代理, 同时支持 LinkAndroid 便捷 API 和 uiautomator2 原生能力."""

    def __init__(self, device_id: Optional[str] = None, raw_device: Optional[u2.Device] = None):
        self._device_id = device_id
        self._raw_device = raw_device

    @property
    def id(self) -> str:
        if self._device_id:
            return self._device_id
        return str(getattr(self.raw(), "serial", ""))

    def raw(self) -> u2.Device:
        if self._raw_device is None:
            self._raw_device = _connect_raw(self._device_id or _active_device_id())
        return self._raw_device

    def __repr__(self) -> str:
        return f"Device(id={self.id!r})"

    def __call__(self, *args, **kwargs):
        return self.raw()(*args, **kwargs)

    def _with_current(self, callback):
        previous = _la_state._device
        try:
            _la_state._device = self.raw()
            return callback()
        finally:
            _la_state._device = previous

    def __getattr__(self, name: str):
        if name in {"connect", "device", "devices", "raw", "disconnect"}:
            raise AttributeError(name)
        func = globals().get(name)
        if callable(func):
            return lambda *args, **kwargs: self._with_current(lambda: func(*args, **kwargs))
        attr = getattr(self.raw(), name)
        return attr


class DeviceGroup:
    """设备集合.

    直接调用 devices.xxx() 只作用于第一台设备; 多设备同步请使用 la.multi:
        devices = la.devices()
        la.multi.click(devices, 500, 1000)
    """

    def __init__(self, device_ids: Optional[List[str]] = None):
        ids = device_ids if device_ids is not None else _runtime_device_ids()
        self._ids = _unique_device_ids([str(item).strip() for item in ids if str(item).strip()])
        if not self._ids:
            self._ids = ["127.0.0.1"]

    @property
    def ids(self) -> List[str]:
        return list(self._ids)

    def __len__(self) -> int:
        return len(self._ids)

    def __iter__(self):
        return iter([Device(device_id) for device_id in self._ids])

    def __repr__(self) -> str:
        return f"DeviceGroup(ids={self._ids!r})"

    def raw(self) -> List[u2.Device]:
        return [_connect_raw(device_id) for device_id in self._ids]

    def first(self) -> Device:
        return Device(self._ids[0])

    def device(self, index: int = 0) -> Device:
        return Device(self._ids[index])

    def _with_device(self, device_id: str, callback):
        previous = _la_state._device
        try:
            _la_state._device = _connect_raw(device_id)
            return callback()
        finally:
            _la_state._device = previous

    def _run_la_function(self, func, *args, **kwargs) -> List[Any]:
        return [self._with_device(device_id, lambda func=func: func(*args, **kwargs)) for device_id in self._ids]

    def _run_raw_attr(self, name: str, *args, **kwargs) -> List[Any]:
        result = []
        for raw_device in self.raw():
            attr = getattr(raw_device, name)
            result.append(attr(*args, **kwargs) if callable(attr) else attr)
        return result

    def __getattr__(self, name: str):
        return getattr(self.first(), name)


def devices(device_ids: Optional[List[str]] = None) -> DeviceGroup:
    """获取设备集合.

    不传参数时自动读取 LINKANDROID_DEVICE_IDS; 调试时通常只有当前调试设备.
    直接使用 devices.xxx() 默认操作第一台设备; 批量同步请用 la.multi.xxx(devices, ...).
    """
    return DeviceGroup(device_ids)


class Multi:
    """显式多设备同步操作工具."""

    def _normalize(self, target_devices) -> List[Device]:
        if isinstance(target_devices, DeviceGroup):
            return list(target_devices)
        if isinstance(target_devices, Device):
            return [target_devices]
        if isinstance(target_devices, u2.Device):
            return [Device(raw_device=target_devices, device_id=str(getattr(target_devices, "serial", "")))]
        return [
            item if isinstance(item, Device)
            else Device(raw_device=item, device_id=str(getattr(item, "serial", ""))) if isinstance(item, u2.Device)
            else Device(str(item))
            for item in target_devices
        ]

    def __getattr__(self, name: str):
        def runner(target_devices, *args, **kwargs):
            return [getattr(item, name)(*args, **kwargs) for item in self._normalize(target_devices)]
        return runner


multi = Multi()


class Util:
    """常用工具方法."""

    @staticmethod
    def sleep(seconds: float) -> None:
        time.sleep(seconds)

    @staticmethod
    def now() -> str:
        return datetime.now().isoformat()

    @staticmethod
    def jsonLoads(text: str) -> Any:
        return json.loads(text)

    @staticmethod
    def jsonDumps(data: Any, **kwargs) -> str:
        return json.dumps(data, ensure_ascii=False, **kwargs)

    @staticmethod
    def retry(callback, times: int = 3, interval: float = 1):
        last_error = None
        for _ in range(times):
            try:
                return callback()
            except Exception as e:
                last_error = e
                time.sleep(interval)
        raise last_error


class Http:
    """HTTP 请求工具, 基于 requests."""

    @staticmethod
    def get(url: str, **kwargs):
        return requests.get(url, **kwargs)

    @staticmethod
    def post(url: str, **kwargs):
        return requests.post(url, **kwargs)

    @staticmethod
    def request(method: str, url: str, **kwargs):
        return requests.request(method, url, **kwargs)

    @staticmethod
    def json(method: str, url: str, **kwargs):
        response = requests.request(method, url, **kwargs)
        response.raise_for_status()
        return response.json()


util = Util()
util.json_loads = util.jsonLoads
util.json_dumps = util.jsonDumps
http = Http()


# ---------------------------------------------------------------------------
# 连接管理
# ---------------------------------------------------------------------------
from ._connect import connect, disconnect, device, raw  # noqa: E402, F811

# ---------------------------------------------------------------------------
# 基础点击操作 / 拖拽 / 滚动 / 滑动
# ---------------------------------------------------------------------------
from ._click import (  # noqa: E402
    click, tap, doubleClick, longClick,
    drag, scrollForward, scrollBackward,
    swipe, swipeExt, swipeTo,
    double_click, long_click, scroll_forward, scroll_backward, swipe_ext, swipe_to,
)

# ---------------------------------------------------------------------------
# 文字输入
# ---------------------------------------------------------------------------
from ._input import (  # noqa: E402
    text, inputText, clearText, sendKeys, typeText,
    input_text, clear_text, send_keys, type_text,
)

# ---------------------------------------------------------------------------
# 截图 & UI 层次
# ---------------------------------------------------------------------------
from ._screenshot import (  # noqa: E402
    screenshot, dumpHierarchy, dumpXmlToFile,
    dump_hierarchy, dump_xml_to_file,
)

# ---------------------------------------------------------------------------
# 元素查找
# ---------------------------------------------------------------------------
from ._selector import (  # noqa: E402
    selector, select, find, findOne, findAll, count, exists, wait,
    clickText, tapText, tapDesc, tapId, tapExists, clickIfExists,
    findByXpath,
    clickElement, clickCenter, getText, getBounds, info, center,
    find_one, find_all, click_text, tap_text, tap_desc, tap_id, tap_exists, click_if_exists,
    find_by_xpath, click_element, click_center, get_text, get_bounds,
)

# ---------------------------------------------------------------------------
# 应用管理
# ---------------------------------------------------------------------------
from ._app import (  # noqa: E402
    appStart, appStop, appClear,
    appCurrent, appList, appInstall, appUninstall,
    app_start, app_stop, app_clear, app_current, app_list, app_install, app_uninstall,
)

# ---------------------------------------------------------------------------
# 按键事件
# ---------------------------------------------------------------------------
from ._key import (  # noqa: E402
    press, home, back, menu, recent, power,
    pressHome, pressBack, pressMenu, pressRecent, pressPower,
    pressEnter, pressDel,
    press_home, press_back, press_menu, press_recent, press_power, press_enter, press_del,
    KEY_MAP,
)

# ---------------------------------------------------------------------------
# 屏幕信息 & 设备信息
# ---------------------------------------------------------------------------
from ._info import (  # noqa: E402
    width, height, size,
    deviceInfo, serial, wlanIp, battery,
    currentPackage, currentActivity,
    device_info, wlan_ip, current_package, current_activity,
)

# ---------------------------------------------------------------------------
# 实用工具
# ---------------------------------------------------------------------------
from ._utils import (  # noqa: E402
    openUrl, toast, setFastInputIme,
    isScreenOn, screenOn, screenOff, unlock,
    openNotification, openQuickSettings,
    setClipboard, getClipboard,
    startScreenRecord, stopScreenRecord,
    memoryInfo, cpuInfo,
    sleep, waitIdle, waitActivity, waitUntil, waitUntilGone,
    open_url, set_fast_input_ime,
    is_screen_on, screen_on, screen_off,
    open_notification, open_quick_settings,
    set_clipboard, get_clipboard,
    start_screen_record, stop_screen_record,
    memory_info, cpu_info,
    wait_idle, wait_activity, wait_until, wait_until_gone,
)

# ---------------------------------------------------------------------------
# 大模型调用
# ---------------------------------------------------------------------------
from ._llm import llm  # noqa: E402
