"""
la._selector — UI 元素查找与选择.
"""
from __future__ import annotations

import time
from typing import Any, List, Optional, Tuple

from . import _state as _la_state
from ._state import _require_device
from ._click import click


class ElementNotFoundError(RuntimeError):
    """元素查找未命中时抛出, 携带选择器与排查建议.

    避免出现晦涩的 ``AttributeError: 'NoneType' object has no attribute 'click'``.
    """

    def __init__(self, selector_desc: str):
        super().__init__(
            f"未找到匹配的 UI 元素 ({selector_desc})。\n"
            "可能原因: 筛选条件不正确, 或元素尚未出现。\n"
            "建议:\n"
            "  1. 先等待元素出现: device.wait(text=..., timeout=10) 或 device.exists(text=..., timeout=5);\n"
            "  2. 直接安全点击: device.tapText(\"确定\", timeout=5) / tapId(...) / tapDesc(...) / tapExists(...);\n"
            "  3. 需要拿到元素对象再操作时, 改用 device.findOrNull(...) 并判空后再调用。"
        )


def _normalize_selector_kwargs(kwargs: dict) -> dict:
    selector = dict(kwargs)
    alias_map = {
        "id": "resourceId",
        "resource_id": "resourceId",
        "resourceID": "resourceId",
        "desc": "description",
        "content_desc": "description",
        "contentDescription": "description",
        "class_name": "className",
        "package_name": "packageName",
    }
    for src, dst in alias_map.items():
        if src in selector and dst not in selector:
            selector[dst] = selector.pop(src)
    return selector


def _build_selector(
    text: Optional[str] = None,
    className: Optional[str] = None,
    resourceId: Optional[str] = None,
    description: Optional[str] = None,
) -> dict:
    selector: dict = {}
    if text is not None:
        selector["text"] = text
    if className is not None:
        selector["className"] = className
    if resourceId is not None:
        selector["resourceId"] = resourceId
    if description is not None:
        selector["description"] = description
    if not selector:
        raise ValueError("至少需要指定一个筛选条件")
    return selector


@_require_device
def selector(**kwargs) -> Any:
    """创建 uiautomator2 原生选择器对象.

    支持常用别名:
        id/resource_id -> resourceId
        desc/content_desc -> description
        class_name -> className

    Examples:
        la.selector(text="设置").click()
        la.selector(id="com.android.settings:id/title").exists
    """
    selector_kwargs = _normalize_selector_kwargs(kwargs)
    if not selector_kwargs:
        raise ValueError("至少需要指定一个筛选条件")
    return _la_state._device(**selector_kwargs)


def select(**kwargs) -> Any:
    """selector() 的短别名."""
    return selector(**kwargs)


def _describe_selector(selector: dict) -> str:
    """将选择器格式化为可读描述, 用于报错信息."""
    return "、".join(f"{key}={value!r}" for key, value in selector.items())


def _build_find_selector(
    text: Optional[str],
    className: Optional[str],
    resourceId: Optional[str],
    description: Optional[str],
    packageName: Optional[str],
) -> dict:
    selector = {}
    if text is not None:
        selector["text"] = text
    if className is not None:
        selector["className"] = className
    if resourceId is not None:
        selector["resourceId"] = resourceId
    if description is not None:
        selector["description"] = description
    if packageName is not None:
        selector["packageName"] = packageName
    if not selector:
        raise ValueError("至少需要指定一个筛选条件 (text/className/resourceId/description)")
    return selector


def _find_element(selector: dict, index: int):
    """返回第 index 个匹配元素, 找不到时返回 None."""
    elements = _la_state._device(**selector)
    count = elements.count
    if count == 0:
        return None
    return elements[index] if index < count else None


@_require_device
def find(
    text: Optional[str] = None,
    *,
    className: Optional[str] = None,
    resourceId: Optional[str] = None,
    description: Optional[str] = None,
    packageName: Optional[str] = None,
    index: int = 0,
) -> Any:
    """查找 UI 元素.

    Args:
        text: 匹配文本
        className: 类名 (如 "android.widget.TextView")
        resourceId: 资源 ID (如 "com.android.settings:id/title")
        description: content-desc 描述
        packageName: 包名
        index: 如果有多个匹配, 取第几个 (默认 0)

    Returns:
        uiautomator2 UiObject

    Raises:
        ElementNotFoundError: 未找到匹配元素 (报错信息含排查建议)
        ValueError: 未指定任何筛选条件

    Notes:
        未找到元素时会抛 ElementNotFoundError, 而不是返回 None,
        避免脚本出现 ``'NoneType' object has no attribute 'click'`` 这类晦涩报错。
        如需"找不到返回 None"的语义, 请使用 findOrNull()。
    """
    selector = _build_find_selector(text, className, resourceId, description, packageName)
    elem = _find_element(selector, index)
    if elem is None:
        raise ElementNotFoundError(_describe_selector(selector))
    return elem


@_require_device
def findOrNull(
    text: Optional[str] = None,
    *,
    className: Optional[str] = None,
    resourceId: Optional[str] = None,
    description: Optional[str] = None,
    packageName: Optional[str] = None,
    index: int = 0,
) -> Optional[Any]:
    """查找 UI 元素, 未找到时返回 None (不抛异常).

    参数与返回值语义与旧版 find() 一致, 适合需要判空的场景:

    Examples:
        elem = device.findOrNull(text="确定")
        if elem:
            elem.click()
        else:
            print("未找到确定按钮")
    """
    selector = _build_find_selector(text, className, resourceId, description, packageName)
    return _find_element(selector, index)


findOne = find


@_require_device
def exists(
    text: Optional[str] = None,
    *,
    className: Optional[str] = None,
    resourceId: Optional[str] = None,
    description: Optional[str] = None,
    timeout: float = 0,
) -> bool:
    """判断元素是否存在.

    Args:
        筛选参数同 find()
        timeout: 等待超时秒数 (0=不等待)

    Returns:
        是否存在
    """
    selector = _build_selector(text, className, resourceId, description)
    if timeout > 0:
        return _la_state._device(**selector).wait(timeout=timeout)
    return _la_state._device(**selector).exists


@_require_device
def wait(
    text: Optional[str] = None,
    *,
    className: Optional[str] = None,
    resourceId: Optional[str] = None,
    description: Optional[str] = None,
    timeout: float = 10,
) -> bool:
    """等待元素出现；未传选择器时等待设备空闲.

    Returns:
        超时内是否出现
    """
    if text is None and className is None and resourceId is None and description is None:
        if hasattr(_la_state._device, "wait_idle"):
            _la_state._device.wait_idle(timeout=timeout)
        else:
            time.sleep(timeout)
        return True
    return exists(text, className=className, resourceId=resourceId,
                  description=description, timeout=timeout)


@_require_device
def clickText(
    text: str,
    *,
    timeout: float = 5,
) -> bool:
    """点击包含指定文本的控件.

    Returns:
        是否点击成功
    """
    return _la_state._device(text=text).click_exists(timeout=timeout)


def tapText(text: str, *, timeout: float = 5) -> bool:
    """点击指定文本元素."""
    return clickText(text, timeout=timeout)


@_require_device
def tapDesc(description: str, *, timeout: float = 5) -> bool:
    """点击指定 content-desc 元素."""
    return _la_state._device(description=description).click_exists(timeout=timeout)


@_require_device
def tapId(resourceId: str, *, timeout: float = 5) -> bool:
    """点击指定 resource-id 元素."""
    return _la_state._device(resourceId=resourceId).click_exists(timeout=timeout)


@_require_device
def tapExists(timeout: float = 5, **kwargs) -> bool:
    """如果元素存在则点击.

    Examples:
        la.tapExists(text="允许", timeout=3)
        la.tapExists(id="com.demo:id/submit")
        la.tapExists(desc="更多选项")
    """
    return _normalize_selector_kwargs(kwargs) and _la_state._device(**_normalize_selector_kwargs(kwargs)).click_exists(timeout=timeout)


def clickIfExists(timeout: float = 5, **kwargs) -> bool:
    """tapExists() 的语义化别名."""
    return tapExists(timeout=timeout, **kwargs)


@_require_device
def findAll(
    text: Optional[str] = None,
    *,
    className: Optional[str] = None,
    resourceId: Optional[str] = None,
    description: Optional[str] = None,
    packageName: Optional[str] = None,
) -> List[Any]:
    """查找所有匹配的 UI 元素.

    Returns:
        匹配的元素列表 (可能为空)
    """
    selector = {}
    if text is not None:
        selector["text"] = text
    if className is not None:
        selector["className"] = className
    if resourceId is not None:
        selector["resourceId"] = resourceId
    if description is not None:
        selector["description"] = description
    if packageName is not None:
        selector["packageName"] = packageName
    if not selector:
        raise ValueError("至少需要指定一个筛选条件")

    elements = _la_state._device(**selector)
    return [elements[i] for i in range(elements.count)]


@_require_device
def count(
    text: Optional[str] = None,
    *,
    className: Optional[str] = None,
    resourceId: Optional[str] = None,
    description: Optional[str] = None,
) -> int:
    """统计匹配的元素数量.

    Returns:
        匹配的元素个数
    """
    selector = _build_selector(text, className, resourceId, description)
    return _la_state._device(**selector).count


@_require_device
def clickElement(element: Any) -> None:
    """点击一个已获取的 UI 元素对象.

    Args:
        element: 由 find() / findAll() 返回的 UiObject

    Raises:
        ElementNotFoundError: element 为 None (来自 findOrNull()/findAll() 判空失败)
    """
    if element is None:
        raise ElementNotFoundError("None (元素对象为空, 请先确认 findOrNull()/findAll() 返回非空)")
    element.click()


@_require_device
def getText(element: Any) -> str:
    """获取 UI 元素的文本内容.

    Args:
        element: 由 find() / findAll() 返回的 UiObject

    Returns:
        元素的 text 属性
    """
    if element is None:
        raise ElementNotFoundError("None (元素对象为空, 请先确认 findOrNull()/findAll() 返回非空)")
    return element.info.get("text", "")


@_require_device
def getBounds(element: Any) -> dict:
    """获取 UI 元素的边界坐标.

    Args:
        element: 由 find() / findAll() 返回的 UiObject

    Returns:
        {"left": int, "top": int, "right": int, "bottom": int}
    """
    if element is None:
        raise ElementNotFoundError("None (元素对象为空, 请先确认 findOrNull()/findAll() 返回非空)")
    return element.info.get("bounds", {})


def info(element: Any) -> dict:
    """获取元素 info 字典."""
    if element is None:
        raise ElementNotFoundError("None (元素对象为空, 请先确认 findOrNull()/findAll() 返回非空)")
    return element.info


def center(element: Any) -> Tuple[int, int]:
    """获取元素中心点坐标."""
    if element is None:
        raise ElementNotFoundError("None (元素对象为空, 请先确认 findOrNull()/findAll() 返回非空)")
    bounds = getBounds(element)
    return (
        int((bounds.get("left", 0) + bounds.get("right", 0)) / 2),
        int((bounds.get("top", 0) + bounds.get("bottom", 0)) / 2),
    )


def clickCenter(element: Any) -> None:
    """点击元素中心点."""
    x, y = center(element)
    click(x, y)


@_require_device
def findByXpath(xpath: str) -> Optional[Any]:
    """通过 XPath 查找 UI 元素.

    Args:
        xpath: XPath 表达式

    Returns:
        UiObject 或 None
    """
    results = _la_state._device.xpath(xpath)
    if results is None:
        return None
    return results


find_one = findOne
find_all = findAll
find_or_null = findOrNull
find_or_none = findOrNull
findOrNone = findOrNull
click_text = clickText
tap_text = tapText
tap_desc = tapDesc
tap_id = tapId
tap_exists = tapExists
click_if_exists = clickIfExists
find_by_xpath = findByXpath
click_element = clickElement
click_center = clickCenter
get_text = getText
get_bounds = getBounds
