#!/usr/bin/env bash
#
# init-linux.sh — Linux 下载并配置 portable Python 环境
#
# 用法:
#   chmod +x init-linux.sh && ./init-linux.sh
#
# 作用:
#   1. 从 astral-sh/python-build-standalone 下载 portable Python
#   2. 解压到 _aienv/ 目录
#   3. 安装 uiautomator2 等依赖
#   4. 创建 lib/ 目录（存放 la.py 等辅助模块）
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="${SCRIPT_DIR}/_aienv"
LIB_DIR="${SCRIPT_DIR}/lib"
CACHE_DIR="${SCRIPT_DIR}/_cache"
STANDALONE_TAG="20260610"
PYTHON_VERSION="3.12.13"

ARCH="$(uname -m)"
case "$ARCH" in
  x86_64|amd64)
    TARGET="x86_64-unknown-linux-gnu"
    ;;
  aarch64|arm64)
    TARGET="aarch64-unknown-linux-gnu"
    ;;
  *)
    echo "[ERROR] 不支持的架构: ${ARCH}"
    exit 1
    ;;
esac

echo "[INFO] 系统架构: ${ARCH} → ${TARGET}"

if [ -d "$VENV_DIR" ] && [ -f "${VENV_DIR}/bin/python" ]; then
  echo "[INFO] Python 环境已存在: ${VENV_DIR}"
  echo "[INFO] Python: $("${VENV_DIR}/bin/python" --version 2>&1)"
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
mkdir -p "$VENV_DIR"
tar -xzf "${CACHE_DIR}/${FILENAME}" -C "$VENV_DIR" --strip-components=1

if [ ! -f "${VENV_DIR}/bin/python" ]; then
  echo "[ERROR] 解压后未找到 bin/python"
  exit 1
fi

echo "[INFO] Python: $("${VENV_DIR}/bin/python" --version 2>&1)"

echo "[INFO] 升级 pip..."
"${VENV_DIR}/bin/python" -m pip install --upgrade pip -q

echo "[INFO] 安装依赖..."
"${VENV_DIR}/bin/python" -m pip install uiautomator2 requests pillow psutil -q

mkdir -p "$LIB_DIR"

echo ""
echo "[DONE] 初始化完成!"
echo ""
echo "  运行 Python: ${VENV_DIR}/bin/python"
echo "  导入帮助:   sys.path.insert(0, '${LIB_DIR}'); import la"
echo "  预装库:     uiautomator2, requests, pillow, psutil"
echo ""
