"""
la._utils — 实用工具 (通知/剪贴板/录屏/性能/等待等).
"""
from __future__ import annotations

import time
from typing import Optional

from . import _state as _la_state
from ._state import _require_device


# ---------------------------------------------------------------------------
# 实用工具
# ---------------------------------------------------------------------------

@_require_device
def openUrl(url: str) -> None:
    """通过浏览器打开 URL."""
    _la_state._device.open_url(url)


@_require_device
def toast(message: str, duration: float = 1.0) -> None:
    """在设备上显示 Toast 消息."""
    _la_state._device.make_toast(message, duration)


@_require_device
def setFastInputIme(enable: bool = True) -> bool:
    """启用/关闭快速输入法 (绕过输入法直接填文字)."""
    if enable:
        return _la_state._device.set_fastinput_ime(True)
    else:
        return _la_state._device.set_fastinput_ime(False)


# ---------------------------------------------------------------------------
# 屏幕开关 / 解锁
# ---------------------------------------------------------------------------

@_require_device
def isScreenOn() -> bool:
    """判断屏幕是否亮着."""
    return _la_state._device.info.get("screenOn", False)


@_require_device
def screenOn() -> None:
    """点亮屏幕."""
    _la_state._device.screen_on()


@_require_device
def screenOff() -> None:
    """熄灭屏幕."""
    _la_state._device.screen_off()


@_require_device
def unlock() -> None:
    """解锁屏幕 (滑动解锁)."""
    _la_state._device.unlock()


# ---------------------------------------------------------------------------
# 通知 & 快捷设置
# ---------------------------------------------------------------------------

@_require_device
def openNotification() -> None:
    """打开通知栏."""
    _la_state._device.open_notification()


@_require_device
def openQuickSettings() -> None:
    """打开快捷设置面板."""
    _la_state._device.open_quick_settings()


# ---------------------------------------------------------------------------
# 剪贴板
# ---------------------------------------------------------------------------

@_require_device
def setClipboard(text: str) -> None:
    """设置设备剪贴板内容.

    Args:
        text: 要设置的文本
    """
    _la_state._device.set_clipboard(text)


@_require_device
def getClipboard() -> str:
    """获取设备剪贴板内容.

    Returns:
        剪贴板文本
    """
    return _la_state._device.clipboard


# ---------------------------------------------------------------------------
# 屏幕录制
# ---------------------------------------------------------------------------

@_require_device
def startScreenRecord(path: str = "/sdcard/screen_record.mp4") -> None:
    """开始屏幕录制 (保存到设备).

    Args:
        path: 设备上保存路径
    """
    _la_state._device.screenrecord.start(path)


@_require_device
def stopScreenRecord() -> None:
    """停止屏幕录制."""
    _la_state._device.screenrecord.stop()


# ---------------------------------------------------------------------------
# 性能信息
# ---------------------------------------------------------------------------

@_require_device
def memoryInfo() -> dict:
    """获取设备内存信息.

    Returns:
        内存信息 dict (total, used, etc.)
    """
    return _la_state._device.shell("cat /proc/meminfo").output


@_require_device
def cpuInfo() -> str:
    """获取设备 CPU 信息.

    Returns:
        CPU 信息字符串
    """
    return _la_state._device.shell("cat /proc/cpuinfo").output


# ---------------------------------------------------------------------------
# 等待 & 休眠
# ---------------------------------------------------------------------------

def sleep(seconds: float) -> None:
    """休眠指定秒数.

    Args:
        seconds: 休眠秒数 (可以是小数)
    """
    time.sleep(seconds)


def waitIdle(timeout: float = 5) -> None:
    """等待设备空闲.

    Args:
        timeout: 最大等待秒数
    """
    if _la_state._device:
        if hasattr(_la_state._device, "wait_idle"):
            _la_state._device.wait_idle(timeout=timeout)
        else:
            time.sleep(timeout)


@_require_device
def waitActivity(activity: str, timeout: float = 10) -> bool:
    """等待指定 Activity 出现.

    Args:
        activity: Activity 名称 (支持正则)
        timeout: 超时秒数

    Returns:
        是否在超时内出现

    Examples:
        la.waitActivity(".Settings", timeout=15)
        la.waitActivity(r"com\\.android\\..*", timeout=30)
    """
    return _la_state._device.wait_activity(activity, timeout=timeout)


def waitUntil(predicate, timeout: float = 10, interval: float = 0.5) -> bool:
    """等待自定义条件成立.

    Args:
        predicate: 无参数函数, 返回 True 表示条件成立
        timeout: 超时秒数
        interval: 轮询间隔秒数

    Returns:
        是否在超时内成立

    Examples:
        la.waitUntil(lambda: la.exists(text="设置"), timeout=10)
    """
    deadline = time.time() + timeout
    while time.time() <= deadline:
        if predicate():
            return True
        time.sleep(interval)
    return False


@_require_device
def waitUntilGone(
    text: Optional[str] = None,
    *,
    className: Optional[str] = None,
    resourceId: Optional[str] = None,
    description: Optional[str] = None,
    timeout: float = 10,
) -> bool:
    """等待元素消失.

    Returns:
        是否在超时内消失
    """
    from ._selector import _build_selector  # avoid circular
    selector = _build_selector(text, className, resourceId, description)
    return _la_state._device(**selector).wait_gone(timeout=timeout)


open_url = openUrl
set_fast_input_ime = setFastInputIme
is_screen_on = isScreenOn
screen_on = screenOn
screen_off = screenOff
open_notification = openNotification
open_quick_settings = openQuickSettings
set_clipboard = setClipboard
get_clipboard = getClipboard
start_screen_record = startScreenRecord
stop_screen_record = stopScreenRecord
memory_info = memoryInfo
cpu_info = cpuInfo
wait_idle = waitIdle
wait_activity = waitActivity
wait_until = waitUntil
wait_until_gone = waitUntilGone
