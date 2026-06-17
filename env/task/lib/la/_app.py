"""
la._app — 应用管理.
"""
from __future__ import annotations

from . import _state as _la_state
from ._state import _require_device


@_require_device
def app_start(package_name: str, activity: Optional[str] = None) -> None:
    """启动应用."""
    _la_state._device.app_start(package_name, activity=activity)


@_require_device
def app_stop(package_name: str) -> None:
    """停止应用."""
    _la_state._device.app_stop(package_name)


@_require_device
def app_clear(package_name: str) -> None:
    """清除应用数据."""
    _la_state._device.app_clear(package_name)


@_require_device
def app_current() -> dict:
    """获取当前前台应用信息.

    Returns:
        {"package": str, "activity": str}
    """
    return _la_state._device.app_current()


@_require_device
def app_list() -> list:
    """列出正在运行的应用包名列表."""
    return _la_state._device.app_list()


@_require_device
def app_install(url_or_path: str) -> None:
    """安装 APK."""
    _la_state._device.app_install(url_or_path)


@_require_device
def app_uninstall(package_name: str) -> None:
    """卸载应用."""
    _la_state._device.app_uninstall(package_name)
