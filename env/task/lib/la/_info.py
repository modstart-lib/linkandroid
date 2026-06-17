"""
la._info — 屏幕信息 & 设备信息.
"""
from __future__ import annotations

from typing import Tuple

from . import _state as _la_state
from ._state import _require_device


# ---------------------------------------------------------------------------
# 屏幕信息
# ---------------------------------------------------------------------------

@_require_device
def width() -> int:
    """获取屏幕宽度 (px)."""
    return _la_state._device.info.get("displayWidth", 0)


@_require_device
def height() -> int:
    """获取屏幕高度 (px)."""
    return _la_state._device.info.get("displayHeight", 0)


@_require_device
def size() -> Tuple[int, int]:
    """获取屏幕尺寸 (width, height)."""
    info = _la_state._device.info
    return (info.get("displayWidth", 0), info.get("displayHeight", 0))


# ---------------------------------------------------------------------------
# 设备信息
# ---------------------------------------------------------------------------

@_require_device
def device_info() -> dict:
    """获取完整的设备信息."""
    return _la_state._device.info


@_require_device
def serial() -> str:
    """获取设备序列号."""
    return _la_state._device.serial


@_require_device
def wlan_ip() -> str:
    """获取设备 WLAN IP 地址."""
    return _la_state._device.wlan_ip


@_require_device
def battery() -> dict:
    """获取电池信息."""
    return _la_state._device.battery_info


@_require_device
def current_package() -> str:
    """获取当前前台应用的包名.

    Returns:
        包名字符串
    """
    return _la_state._device.app_current().get("package", "")


@_require_device
def current_activity() -> str:
    """获取当前前台 Activity 名称.

    Returns:
        Activity 名称字符串
    """
    return _la_state._device.app_current().get("activity", "")
