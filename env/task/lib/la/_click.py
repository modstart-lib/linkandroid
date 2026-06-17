"""
la._click — 点击、拖拽、滚动、滑动操作.
"""
from __future__ import annotations

import time
from typing import Optional

from . import _state as _la_state
from ._state import _require_device


# ---------------------------------------------------------------------------
# 基础点击操作
# ---------------------------------------------------------------------------

@_require_device
def click(x: int, y: int, *, timeout: float = 0) -> None:
    """点击屏幕坐标.

    Args:
        x: X 坐标
        y: Y 坐标
        timeout: 点击后等待时间(秒)
    """
    _la_state._device.click(x, y)
    if timeout > 0:
        time.sleep(timeout)


def tap(x: int, y: int, *, timeout: float = 0) -> None:
    """点击屏幕坐标 (click 的短别名)."""
    return click(x, y, timeout=timeout)


@_require_device
def double_click(x: int, y: int, duration: float = 0.1) -> None:
    """双击屏幕坐标."""
    _la_state._device.double_click(x, y, duration)


@_require_device
def long_click(x: int, y: int, duration: float = 0.5) -> None:
    """长按屏幕坐标."""
    _la_state._device.long_click(x, y, duration)


# ---------------------------------------------------------------------------
# 拖拽操作
# ---------------------------------------------------------------------------

@_require_device
def drag(fx: int, fy: int, tx: int, ty: int, duration: float = 0.5) -> None:
    """拖拽: 从 (fx, fy) 拖到 (tx, ty).

    Args:
        fx, fy: 起始坐标
        tx, ty: 目标坐标
        duration: 拖拽持续秒数
    """
    _la_state._device.drag(fx, fy, tx, ty, duration=duration)


@_require_device
def scroll_forward() -> bool:
    """向前滚动 (列表/WebView 向下翻).

    Returns:
        是否可以继续滚动
    """
    return _la_state._device.scroll.forward()


@_require_device
def scroll_backward() -> bool:
    """向后滚动 (列表/WebView 向上翻).

    Returns:
        是否可以继续滚动
    """
    return _la_state._device.scroll.backward()


# ---------------------------------------------------------------------------
# 滑动操作
# ---------------------------------------------------------------------------

@_require_device
def swipe(
    fx: int, fy: int, tx: int, ty: int,
    duration: float = 0.1,
    steps: Optional[int] = None,
) -> None:
    """从 (fx, fy) 滑动到 (tx, ty).

    Args:
        fx, fy: 起始坐标
        tx, ty: 目标坐标
        duration: 滑动持续秒数 (与 steps 二选一)
        steps: 滑动步数 (与 duration 二选一)
    """
    if steps is not None:
        _la_state._device.swipe(fx, fy, tx, ty, steps=steps)
    else:
        _la_state._device.swipe(fx, fy, tx, ty, duration=duration)


@_require_device
def swipe_ext(
    direction: str,
    scale: float = 0.9,
    duration: float = 0.1,
) -> None:
    """沿方向滑动屏幕.

    Args:
        direction: "left", "right", "up", "down"
        scale: 滑动距离占屏幕尺寸比例 (0~1), 默认 0.9
        duration: 滑动持续秒数
    """
    direction_map = {
        "left": "left",
        "右": "left",
        "right": "right",
        "左": "right",
        "up": "up",
        "上": "up",
        "down": "down",
        "下": "down",
    }
    d = direction_map.get(direction, direction)
    _la_state._device.swipe_ext(d, scale=scale, duration=duration)


@_require_device
def swipe_to(
    direction: str,
    *,
    scale: float = 0.9,
    timeout: float = 10,
    **kwargs,
) -> bool:
    """滑动直到找到目标元素 (常用于滑动翻页).

    Args:
        direction: "left"/"right"/"up"/"down"
        scale: 滑动比例
        timeout: 超时秒数
        **kwargs: uiautomator2 元素选择参数 (text/className/resourceId等)

    Returns:
        是否找到

    Examples:
        la.swipe_to("up", text="设置", timeout=15)
    """
    return _la_state._device.swipe_to(direction, scale=scale, timeout=timeout, **kwargs)
