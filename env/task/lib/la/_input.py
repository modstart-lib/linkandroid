"""
la._input — 文字输入.
"""
from __future__ import annotations

from . import _state as _la_state
from ._state import _require_device


@_require_device
def text(text: str, *, clear: bool = False, enter: bool = False) -> None:
    """输入文本.

    Args:
        text: 要输入的文本
        clear: 是否先清空输入框
        enter: 输入后是否按回车
    """
    if clear:
        _la_state._device.clear_text()
    _la_state._device.send_keys(text)
    if enter:
        _la_state._device.send_action("search")


def input_text(value: str, *, clear: bool = False, enter: bool = False) -> None:
    """输入文本 (text 的语义化别名)."""
    return text(value, clear=clear, enter=enter)


@_require_device
def clear_text() -> None:
    """清空当前焦点输入框."""
    _la_state._device.clear_text()


@_require_device
def send_keys(text: str) -> None:
    """发送按键序列 (别名)."""
    _la_state._device.send_keys(text)


def type_text(txt: str) -> None:
    """输入文本 (text() 的别名, 语义更清晰)."""
    return text(txt)
