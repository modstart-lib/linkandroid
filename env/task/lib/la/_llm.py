"""
la.llm — 大模型调用封装.

用法:
    import la

    # 简单调用
    reply = la.llm.call("你是 AI 助手", "写一首诗")

    # 流式输出到 stdout
    for chunk in la.llm.call_stream("你是 AI 助手", "写一首诗"):
        print(chunk, end="", flush=True)

环境变量 (由 LinkAndroid 注入):
    LINKANDROID_LLM_ENABLED  - 是否启用 ("1" / "0")
    LINKANDROID_LLM_TYPE     - 供应商类型 (如 "openai")
    LINKANDROID_LLM_API_URL  - API 完整地址 (如 "https://api.openai.com/v1/chat/completions")
    LINKANDROID_LLM_API_KEY  - API Key
    LINKANDROID_LLM_MODEL    - 模型 ID (如 "gpt-4o")
"""
from __future__ import annotations

import json
import os
import sys
from typing import Any, Dict, Generator, List, Optional

import requests


# ---------------------------------------------------------------------------
# 内部: 读取配置
# ---------------------------------------------------------------------------

def _get_config() -> dict:
    """从环境变量读取 LLM 配置, 未配置时抛出 RuntimeError."""
    enabled = os.environ.get("LINKANDROID_LLM_ENABLED", "")
    if enabled != "1":
        raise RuntimeError(
            "LLM 未启用, 请先在 LinkAndroid 中配置并启用至少一个大模型.\n"
            "设置入口: 设置 → 大模型"
        )
    config = {
        "type": os.environ.get("LINKANDROID_LLM_TYPE", "openai"),
        "api_url": os.environ.get("LINKANDROID_LLM_API_URL", ""),
        "api_key": os.environ.get("LINKANDROID_LLM_API_KEY", ""),
        "model": os.environ.get("LINKANDROID_LLM_MODEL", ""),
    }
    missing = [k for k, v in config.items() if not v]
    if missing:
        raise RuntimeError(
            f"LLM 配置不完整, 缺少: {', '.join(missing)}. "
            f"请检查 LinkAndroid 大模型设置."
        )
    return config


# ---------------------------------------------------------------------------
# 公开 API
# ---------------------------------------------------------------------------

class LLM:
    """大模型调用工具 (la.llm)."""

    def call(
        self,
        system_prompt: Optional[str] = None,
        user_prompt: str = "",
        *,
        timeout: int = 120,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
    ) -> str:
        """调用大模型, 返回回复文本.

        Args:
            system_prompt: 系统提示词.
            user_prompt:   用户提示词.
            timeout:       超时秒数 (默认 120).
            temperature:   温度参数 (None 表示使用默认).
            max_tokens:    最大生成 token 数 (None 表示使用默认).

        Returns:
            模型回复的文本内容.

        Raises:
            RuntimeError: 配置缺失或 API 调用失败.
        """
        cfg = _get_config()
        messages = self._build_messages(system_prompt, user_prompt)
        body: Dict[str, Any] = {"model": cfg["model"], "messages": messages}
        if temperature is not None:
            body["temperature"] = temperature
        if max_tokens is not None:
            body["max_tokens"] = max_tokens

        headers = {
            "Authorization": f"Bearer {cfg['api_key']}",
            "Content-Type": "application/json",
        }

        try:
            resp = requests.post(
                cfg["api_url"],
                headers=headers,
                json=body,
                timeout=timeout,
            )
        except requests.RequestException as e:
            raise RuntimeError(f"LLM 请求失败: {e}") from e

        if not resp.ok:
            detail = resp.text[:500]
            raise RuntimeError(
                f"LLM 请求失败 (HTTP {resp.status_code}): {detail}"
            )

        try:
            data = resp.json()
            content = data["choices"][0]["message"]["content"]
            return content or ""
        except (KeyError, IndexError, json.JSONDecodeError) as e:
            raise RuntimeError(
                f"LLM 响应解析失败: {e}\n响应原文: {resp.text[:500]}"
            ) from e

    def call_stream(
        self,
        system_prompt: Optional[str] = None,
        user_prompt: str = "",
        *,
        timeout: int = 120,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
    ) -> Generator[str, None, None]:
        """流式调用大模型, 逐块 yield 回复文本.

        用法:
            for chunk in la.llm.call_stream("你是一个诗人", "写一首诗"):
                print(chunk, end="", flush=True)
        """
        cfg = _get_config()
        messages = self._build_messages(system_prompt, user_prompt)
        body: Dict[str, Any] = {
            "model": cfg["model"],
            "messages": messages,
            "stream": True,
        }
        if temperature is not None:
            body["temperature"] = temperature
        if max_tokens is not None:
            body["max_tokens"] = max_tokens

        headers = {
            "Authorization": f"Bearer {cfg['api_key']}",
            "Content-Type": "application/json",
        }

        try:
            resp = requests.post(
                cfg["api_url"],
                headers=headers,
                json=body,
                timeout=timeout,
                stream=True,
            )
        except requests.RequestException as e:
            raise RuntimeError(f"LLM 流式请求失败: {e}") from e

        if not resp.ok:
            detail = resp.text[:500]
            raise RuntimeError(
                f"LLM 流式请求失败 (HTTP {resp.status_code}): {detail}"
            )

        for line in resp.iter_lines(decode_unicode=True):
            if not line:
                continue
            if line.startswith("data: "):
                payload = line[6:].strip()
                if payload == "[DONE]":
                    break
                try:
                    chunk = json.loads(payload)
                    delta = chunk["choices"][0].get("delta", {})
                    content = delta.get("content", "")
                    if content:
                        yield content
                except (KeyError, IndexError, json.JSONDecodeError):
                    pass

    # ------------------------------------------------------------------
    # 内部辅助
    # ------------------------------------------------------------------

    @staticmethod
    def _build_messages(
        system_prompt: Optional[str],
        user_prompt: str,
    ) -> List[Dict[str, str]]:
        messages: List[Dict[str, str]] = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": user_prompt})
        return messages


# ---------------------------------------------------------------------------
# 模块级实例 (让 la.llm 可以直接用)
# ---------------------------------------------------------------------------
llm = LLM()
