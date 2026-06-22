"""
la._screenshot — 截图 & UI 层次.
"""
from __future__ import annotations

import os
import platform
import shutil
import subprocess

from . import _state as _la_state
from ._state import _require_device


def _run_with_recovery(callback):
    last_error = None
    for attempt in range(2):
        try:
            return callback()
        except Exception as e:
            last_error = e
            if attempt > 0:
                raise
            _la_state._recover_device_connection()
    raise last_error


def _adb_screenshot(filename: str) -> None:
    device_id = _la_state._device_id or _la_state._active_device_id()
    errors = []
    for adb in _adb_candidates():
        try:
            result = subprocess.run(
                [adb, "-s", device_id, "exec-out", "screencap", "-p"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                check=False,
            )
        except FileNotFoundError as e:
            errors.append(str(e))
            continue
        if result.returncode == 0 and result.stdout:
            with open(filename, "wb") as f:
                f.write(result.stdout)
            return
        errors.append(result.stderr.decode("utf-8", errors="ignore") or "adb screencap failed")
    raise RuntimeError("; ".join([item for item in errors if item]) or "adb screencap failed")


def _adb_candidates() -> list[str]:
    candidates = []
    env_adb = os.environ.get("LINKANDROID_ADB_PATH")
    if env_adb:
        candidates.append(env_adb)
    path_adb = shutil.which("adb")
    if path_adb:
        candidates.append(path_adb)
    candidates.extend(_resource_adb_candidates())
    result = []
    for item in candidates:
        if item and item not in result:
            result.append(item)
    return result


def _resource_adb_candidates() -> list[str]:
    system = platform.system().lower()
    machine = platform.machine().lower()
    if system == "darwin":
        platform_name = "osx"
    elif system == "windows":
        platform_name = "win"
    else:
        platform_name = "linux"
    platform_arch = "arm64" if machine in {"arm64", "aarch64"} else "x86"
    filename = "adb.exe" if platform_name == "win" else "adb"
    roots = [
        os.getcwd(),
        os.path.dirname(os.getcwd()),
        os.path.dirname(os.path.dirname(os.getcwd())),
    ]
    return [
        os.path.join(root, "extra", f"{platform_name}-{platform_arch}", "scrcpy", filename)
        for root in roots
    ] + [
        os.path.join(root, "electron", "resources", "extra", f"{platform_name}-{platform_arch}", "scrcpy", filename)
        for root in roots
    ]


def _take_screenshot(filename: str) -> None:
    try:
        _adb_screenshot(filename)
    except Exception:
        _run_with_recovery(lambda: _la_state._device.screenshot(filename))


@_require_device
def screenshot(
    filename: str = "screenshot.png",
    *,
    quality: int = 90,
) -> bytes:
    """截屏并保存.

    Args:
        filename: 保存路径 (可绝对/相对路径)
        quality: JPEG 质量 (1~100)

    Returns:
        原始图片 bytes
    """
    _take_screenshot(filename)
    with open(filename, "rb") as f:
        return f.read()


@_require_device
def dumpHierarchy() -> str:
    """获取当前界面 UI 层次 XML."""
    return _run_with_recovery(lambda: _la_state._device.dump_hierarchy())


@_require_device
def dumpXmlToFile(path: str = "ui_hierarchy.xml") -> str:
    """获取 UI 层次 XML 并保存到文件.

    Args:
        path: 保存路径

    Returns:
        XML 内容字符串
    """
    xml = _run_with_recovery(lambda: _la_state._device.dump_hierarchy())
    with open(path, "w", encoding="utf-8") as f:
        f.write(xml)
    return xml


dump_hierarchy = dumpHierarchy
dump_xml_to_file = dumpXmlToFile
