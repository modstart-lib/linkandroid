"""
la._key — 按键事件.
"""
from __future__ import annotations

from . import _state as _la_state
from ._state import _require_device

KEY_MAP = {
    "home": "home",
    "back": "back",
    "menu": "menu",
    "recent": "recent",
    "power": "power",
    "volume_up": "volume_up",
    "volume_down": "volume_down",
    "enter": "enter",
    "delete": "delete",
    "search": "search",
    "camera": "camera",
    "settings": "settings",
}


@_require_device
def press(key: str) -> None:
    """模拟按键.

    Args:
        key: 按键名 (home/back/menu/recent/power/volume_up/volume_down/enter/delete/search/...)
    """
    mapped = KEY_MAP.get(key, key)
    _la_state._device.press(mapped)


@_require_device
def home() -> None:
    """按 HOME 键."""
    _la_state._device.press("home")


@_require_device
def back() -> None:
    """按返回键."""
    _la_state._device.press("back")


@_require_device
def menu() -> None:
    """按菜单键."""
    _la_state._device.press("menu")


@_require_device
def recent() -> None:
    """显示最近任务."""
    _la_state._device.press("recent")


@_require_device
def power() -> None:
    """按电源键."""
    _la_state._device.press("power")


# 快捷键别名
@_require_device
def press_home() -> None:
    """按 HOME 键 (press('home') 的别名)."""
    _la_state._device.press("home")


@_require_device
def press_back() -> None:
    """按返回键 (press('back') 的别名)."""
    _la_state._device.press("back")


@_require_device
def press_menu() -> None:
    """按菜单键 (press('menu') 的别名)."""
    _la_state._device.press("menu")


@_require_device
def press_recent() -> None:
    """按最近任务键. (press('recent') 的别名)."""
    _la_state._device.press("recent")


@_require_device
def press_power() -> None:
    """按电源键. (press('power') 的别名)."""
    _la_state._device.press("power")


@_require_device
def press_enter() -> None:
    """按回车键. (press('enter') 的别名)."""
    _la_state._device.press("enter")


@_require_device
def press_del() -> None:
    """按删除键. (press('delete') 的别名)."""
    _la_state._device.press("delete")
