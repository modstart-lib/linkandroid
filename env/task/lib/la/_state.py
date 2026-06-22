"""
la._state — 共享全局状态和内部辅助 (包内部使用, 不公开).
"""
from __future__ import annotations

import functools
import json
import re
import os
import time
from typing import Any, List, Optional

import uiautomator2 as u2

# ---------------------------------------------------------------------------
# 全局设备实例
# ---------------------------------------------------------------------------
_device: Optional[u2.Device] = None
_device_id: Optional[str] = None
error = Exception


def _split_device_ids(value: Optional[str]) -> List[str]:
    if not value:
        return []
    value = value.strip()
    if not value:
        return []
    if value.startswith("["):
        try:
            data = json.loads(value)
            if isinstance(data, list):
                return [str(item).strip() for item in data if str(item).strip()]
        except Exception:
            pass
    return [item.strip() for item in re.split(r"[,;\n]+", value) if item.strip()]


def _runtime_device_ids() -> List[str]:
    ids = _split_device_ids(os.environ.get("LINKANDROID_DEVICE_IDS"))
    if ids:
        return ids
    ids = _split_device_ids(os.environ.get("LINKANDROID_DEVICE_ID"))
    if ids:
        return ids
    ids = _split_device_ids(os.environ.get("ANDROID_DEVICE_ADDR"))
    return ids or ["127.0.0.1"]


def _unique_device_ids(ids: List[str]) -> List[str]:
    result: List[str] = []
    for device_id in ids:
        if device_id and device_id not in result:
            result.append(device_id)
    return result


def _connect_raw(device_id: str) -> u2.Device:
    raw_device = u2.connect(device_id)
    raw_device.wait_timeout = 30
    return raw_device


def _call_if_exists(target: Any, name: str, *args) -> bool:
    callback = getattr(target, name, None)
    if not callable(callback):
        return False
    callback(*args)
    return True


def _recover_device_connection() -> None:
    global _device, _device_id
    current = _device
    if current is not None:
        try:
            if not _call_if_exists(current, "reset_uiautomator"):
                service = getattr(current, "uiautomator", None)
                if service is not None:
                    _call_if_exists(service, "stop")
                    time.sleep(0.5)
                    _call_if_exists(service, "start")
        except Exception:
            pass
    _device = _connect_raw(_device_id or _active_device_id())


def _active_device_id() -> str:
    return _runtime_device_ids()[0]


def _require_device(func):
    """装饰器: 自动确保设备已连接."""
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        if _device is None:
            raise RuntimeError(
                "设备未连接, 请先调用 la.connect()"
            )
        return func(*args, **kwargs)
    return wrapper
