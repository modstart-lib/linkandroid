"""
la._screenshot — 截图 & UI 层次.
"""
from __future__ import annotations

from . import _state as _la_state
from ._state import _require_device


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
    _la_state._device.screenshot(filename)
    with open(filename, "rb") as f:
        return f.read()


@_require_device
def dump_hierarchy() -> str:
    """获取当前界面 UI 层次 XML."""
    return _la_state._device.dump_hierarchy()


@_require_device
def dump_xml_to_file(path: str = "ui_hierarchy.xml") -> str:
    """获取 UI 层次 XML 并保存到文件.

    Args:
        path: 保存路径

    Returns:
        XML 内容字符串
    """
    xml = _la_state._device.dump_hierarchy()
    with open(path, "w", encoding="utf-8") as f:
        f.write(xml)
    return xml
