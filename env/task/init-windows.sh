#!/usr/bin/env bash
#
# init-windows.sh — Windows (Git Bash / MSYS2) 下载并配置 portable Python 环境
#
# 用法:
#   chmod +x init-windows.sh && ./init-windows.sh
#
# 作用:
#   1. 从 astral-sh/python-build-standalone 下载 portable Python
#   2. 解压到 _aienv/Scripts/ 目录
#   3. 安装 uiautomator2 等依赖
#   4. 创建 lib/ 目录（存放 la.py 等辅助模块）
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="${SCRIPT_DIR}/_aienv"
RUNTIME_DIR="${VENV_DIR}/Scripts"
LIB_DIR="${SCRIPT_DIR}/lib"
CACHE_DIR="${SCRIPT_DIR}/_cache"
STANDALONE_TAG="20260610"
PYTHON_VERSION="3.12.13"

ARCH="$(uname -m)"
case "$ARCH" in
  x86_64|amd64)
    TARGET="x86_64-pc-windows-msvc"
    ;;
  aarch64|arm64)
    TARGET="aarch64-pc-windows-msvc"
    ;;
  *)
    echo "[ERROR] 不支持的架构: ${ARCH}"
    exit 1
    ;;
esac

echo "[INFO] 系统架构: ${ARCH} → ${TARGET}"
echo "[INFO] 系统: $(uname -o 2>/dev/null || uname -s)"

if [ -d "$VENV_DIR" ] && [ -f "${RUNTIME_DIR}/python.exe" ]; then
  echo "[INFO] Python 环境已存在: ${VENV_DIR}"
  echo "[INFO] Python: $("${RUNTIME_DIR}/python.exe" --version 2>&1)"
  mkdir -p "$LIB_DIR"
  exit 0
fi

mkdir -p "$CACHE_DIR"

download_python() {
  local filename="$1"
  local url="https://github.com/astral-sh/python-build-standalone/releases/download/${STANDALONE_TAG}/${filename}"
  if [ -f "${CACHE_DIR}/${filename}" ]; then
    echo "[INFO] 使用缓存的 Python: ${CACHE_DIR}/${filename}"
    return 0
  fi
  echo "[INFO] 下载 portable Python ${PYTHON_VERSION}..."
  echo "[INFO] URL: ${url}"
  curl -fL --connect-timeout 30 --max-time 600 "$url" -o "${CACHE_DIR}/${filename}"
}

FILENAME="cpython-${PYTHON_VERSION}+${STANDALONE_TAG}-${TARGET}-install_only_stripped.tar.gz"
if ! download_python "$FILENAME"; then
  rm -f "${CACHE_DIR}/${FILENAME}"
  FILENAME="cpython-${PYTHON_VERSION}+${STANDALONE_TAG}-${TARGET}-install_only.tar.gz"
  download_python "$FILENAME"
fi

echo "[INFO] 解压 Python..."
rm -rf "$VENV_DIR"
mkdir -p "$RUNTIME_DIR"
tar -xzf "${CACHE_DIR}/${FILENAME}" -C "$RUNTIME_DIR" --strip-components=1

if [ ! -f "${RUNTIME_DIR}/python.exe" ]; then
  echo "[ERROR] 解压后未找到 Scripts/python.exe"
  exit 1
fi

echo "[INFO] Python: $("${RUNTIME_DIR}/python.exe" --version 2>&1)"

echo "[INFO] 升级 pip..."
"${RUNTIME_DIR}/python.exe" -m pip install --upgrade pip -q

echo "[INFO] 安装依赖..."
"${RUNTIME_DIR}/python.exe" -m pip install uiautomator2 requests pillow psutil -q

mkdir -p "$LIB_DIR"

echo ""
echo "[DONE] 初始化完成!"
echo ""
echo "  运行 Python: ${RUNTIME_DIR}/python.exe"
echo "  导入帮助:   sys.path.insert(0, '${LIB_DIR}'); import la"
echo "  预装库:     uiautomator2, requests, pillow, psutil"
echo ""
