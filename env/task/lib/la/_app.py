"""
la._app — 应用管理.
"""
from __future__ import annotations

from . import _state as _la_state
from ._state import _require_device


@_require_device
def appStart(package_name: str, activity: Optional[str] = None) -> None:
    """启动应用."""
    _la_state._device.app_start(package_name, activity=activity)


@_require_device
def appStop(package_name: str) -> None:
    """停止应用."""
    _la_state._device.app_stop(package_name)


@_require_device
def appClear(package_name: str) -> None:
    """清除应用数据."""
    _la_state._device.app_clear(package_name)


@_require_device
def appCurrent() -> dict:
    """获取当前前台应用信息.

    Returns:
        {"package": str, "activity": str}
    """
    return _la_state._device.app_current()


@_require_device
def appList() -> list:
    """列出正在运行的应用包名列表."""
    return _la_state._device.app_list()


@_require_device
def appInstall(url_or_path: str) -> None:
    """安装 APK."""
    _la_state._device.app_install(url_or_path)


@_require_device
def appUninstall(package_name: str) -> None:
    """卸载应用."""
    _la_state._device.app_uninstall(package_name)


app_start = appStart
app_stop = appStop
app_clear = appClear
app_current = appCurrent
app_list = appList
app_install = appInstall
app_uninstall = appUninstall
