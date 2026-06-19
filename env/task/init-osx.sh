#!/usr/bin/env bash
#
# init-osx.sh — macOS 下载并配置 portable Python 环境
#
# 用法:
#   chmod +x init-osx.sh && ./init-osx.sh
#
# 作用:
#   1. 从 astral-sh/python-build-standalone 下载 portable Python（无 framework 依赖）
#   2. 解压到 _aienv/ 目录
#   3. 安装 uiautomator2 等依赖
#   4. 创建 lib/ 目录（存放 la.py 等辅助模块）
#
# 使用 python-build-standalone 而非系统 Python venv 的原因是：
#   - 系统 Python (python.org, Homebrew) 通常是 framework 构建，打包后在其他机器上
#     因缺少 /Library/Frameworks/Python.framework 而崩溃
#   - python-build-standalone 是静态/半静态构建，仅依赖系统库，可在任何 macOS 上运行
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="${SCRIPT_DIR}/_aienv"
LIB_DIR="${SCRIPT_DIR}/lib"
CACHE_DIR="${SCRIPT_DIR}/_cache"
STANDALONE_TAG="20260610"
PYTHON_VERSION="3.12.13"

# ---- 检测架构 ----
ARCH="$(uname -m)"
if [ "$ARCH" = "arm64" ]; then
    TARGET="aarch64"
elif [ "$ARCH" = "x86_64" ]; then
    TARGET="x86_64"
else
    echo "[ERROR] 不支持的架构: ${ARCH}"
    exit 1
fi

echo "[INFO] 系统架构: ${ARCH} → ${TARGET}"

# ---- 如果已存在则跳过 ----
if [ -d "$VENV_DIR" ] && [ -f "${VENV_DIR}/bin/python" ]; then
    echo "[INFO] Python 环境已存在: ${VENV_DIR}"
    echo "[INFO] Python: $("${VENV_DIR}/bin/python" --version 2>&1)"
    mkdir -p "$LIB_DIR"
    exit 0
fi

# ---- 下载 portable Python ----
FILENAME="cpython-${PYTHON_VERSION}+${STANDALONE_TAG}-${TARGET}-apple-darwin-install_only.tar.gz"
DOWNLOAD_URL="https://github.com/astral-sh/python-build-standalone/releases/download/${STANDALONE_TAG}/${FILENAME}"

mkdir -p "$CACHE_DIR"

if [ -f "${CACHE_DIR}/${FILENAME}" ]; then
    echo "[INFO] 使用缓存的 Python: ${CACHE_DIR}/${FILENAME}"
else
    echo "[INFO] 下载 portable Python ${PYTHON_VERSION} (${TARGET})..."
    echo "[INFO] URL: ${DOWNLOAD_URL}"
    curl -fL --connect-timeout 30 --max-time 600 "${DOWNLOAD_URL}" -o "${CACHE_DIR}/${FILENAME}"
    echo "[INFO] 下载完成"
fi

# ---- 解压到 _aienv ----
echo "[INFO] 解压 Python..."
rm -rf "$VENV_DIR"
mkdir -p "$VENV_DIR"
tar -xzf "${CACHE_DIR}/${FILENAME}" -C "$VENV_DIR" --strip-components=1

# ---- 验证 Python 可执行 ----
if [ ! -f "${VENV_DIR}/bin/python" ]; then
    echo "[ERROR] 解压后未找到 bin/python"
    exit 1
fi

echo "[INFO] Python: $("${VENV_DIR}/bin/python" --version 2>&1)"

# ---- 验证无 framework 依赖 ----
if otool -L "${VENV_DIR}/bin/python" 2>/dev/null | grep -q "Python.framework"; then
    echo "[ERROR] ${VENV_DIR}/bin/python 仍有 framework 依赖，不可用于打包"
    echo "[ERROR] 请向 astral-sh/python-build-standalone 报告此问题"
    exit 1
fi

# ---- 安装依赖 ----
echo "[INFO] 升级 pip..."
"${VENV_DIR}/bin/python" -m pip install --upgrade pip -q

echo "[INFO] 安装 uiautomator2..."
"${VENV_DIR}/bin/python" -m pip install uiautomator2 -q

echo "[INFO] 安装常用库..."
"${VENV_DIR}/bin/python" -m pip install requests -q
"${VENV_DIR}/bin/python" -m pip install pillow -q
"${VENV_DIR}/bin/python" -m pip install psutil -q

# ---- 创建 lib 目录 ----
mkdir -p "$LIB_DIR"

echo ""
echo "[DONE] 初始化完成!"
echo ""
echo "  运行 Python: ${VENV_DIR}/bin/python"
echo "  导入帮助:   sys.path.insert(0, '${LIB_DIR}'); import la"
echo "  预装库:     uiautomator2, requests, pillow, psutil"
echo ""
