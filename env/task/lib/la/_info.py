"""
la._info — 屏幕信息 & 设备信息.
"""
from __future__ import annotations

from typing import Any, Tuple

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
def deviceInfo() -> dict:
    """获取完整的设备信息."""
    return _la_state._device.info


@_require_device
def serial() -> str:
    """获取设备序列号."""
    return _la_state._device.serial


@_require_device
def wlanIp() -> str:
    """获取设备 WLAN IP 地址."""
    return _la_state._device.wlan_ip


@_require_device
def battery() -> dict:
    """获取电池信息."""
    try:
        return _la_state._device.battery_info
    except AttributeError:
        return _parse_battery_dump(_shell_output("dumpsys battery"))


def _shell_output(command: str) -> str:
    try:
        result = _la_state._device.shell(command)
    except Exception:
        return ""
    output = getattr(result, "output", result)
    return output if isinstance(output, str) else ""


def _parse_battery_dump(output: str) -> dict:
    aliases = {
        "AC powered": "acPowered",
        "USB powered": "usbPowered",
        "Wireless powered": "wirelessPowered",
        "Max charging current": "maxChargingCurrent",
        "Max charging voltage": "maxChargingVoltage",
        "Charge counter": "chargeCounter",
    }
    parsed: dict[str, Any] = {}
    for line in output.splitlines():
        if ":" not in line:
            continue
        raw_key, raw_value = line.strip().split(":", 1)
        key = aliases.get(raw_key, raw_key)
        value = _parse_battery_value(key, raw_value.strip())
        if key == "temperature" and isinstance(value, int):
            value = value / 10
        parsed[key] = value
    return parsed


def _parse_battery_value(key: str, value: str) -> Any:
    if value.lower() in ("true", "false"):
        return value.lower() == "true"
    if key in ("level", "scale", "status", "health", "voltage", "temperature"):
        try:
            return int(value)
        except ValueError:
            return value
    return value


@_require_device
def currentPackage() -> str:
    """获取当前前台应用的包名.

    Returns:
        包名字符串
    """
    return _la_state._device.app_current().get("package", "")


@_require_device
def currentActivity() -> str:
    """获取当前前台 Activity 名称.

    Returns:
        Activity 名称字符串
    """
    return _la_state._device.app_current().get("activity", "")


device_info = deviceInfo
wlan_ip = wlanIp
current_package = currentPackage
current_activity = currentActivity
