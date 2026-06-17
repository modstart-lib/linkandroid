"""
la._connect — 连接管理.
"""
from __future__ import annotations

import os
from typing import Optional

import uiautomator2 as u2

from . import _state as _la_state
from ._state import _require_device, _connect_raw, _active_device_id, _runtime_device_ids


def connect(addr: str = "127.0.0.1") -> u2.Device:
    """连接到 Android 设备.

    Args:
        addr: 设备地址, 格式 "ip:port" 或 "serial".
              默认 "127.0.0.1" (ADB 转发到本地).
              支持环境变量 ANDROID_DEVICE_ADDR 覆盖.

    Returns:
        uiautomator2 Device 实例

    Examples:
        la.connect()                    # 默认 127.0.0.1
        la.connect("192.168.1.100")     # WiFi 连接
        la.connect("emulator-5554")     # 模拟器 serial
    """
    if addr == "127.0.0.1":
        addr = os.environ.get("ANDROID_DEVICE_ADDR", addr)
    _la_state._device = u2.connect(addr)
    _la_state._device.wait_timeout = 30
    return _la_state._device


def disconnect():
    """断开连接 (重置全局设备)."""
    _la_state._device = None


def device():
    """获取当前单设备代理.

    调试运行时为调试设备; 正式运行时为设备列表中的第一台.
    """
    from . import Device  # lazy import to avoid circular dep in __init__
    if _la_state._device is None:
        connect(_active_device_id())
    return Device(raw_device=_la_state._device, device_id=_active_device_id())


def raw() -> u2.Device:
    """获取 uiautomator2 原生 Device 实例.

    用于 LinkAndroid 便捷封装未覆盖的场景:
        d = la.raw()
        d(text="设置").click()
        print(d.app_current())
    """
    if _la_state._device is None:
        connect(_active_device_id())
    return _la_state._device
