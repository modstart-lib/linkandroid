#!/usr/bin/env bash
#
# init-windows.sh — Windows (Git Bash / WSL / Cygwin) 初始化 Python 虚拟环境
#
# 用法:
#   chmod +x init-windows.sh && ./init-windows.sh
#
# 作用:
#   1. 在当前目录创建 _aienv/ 虚拟环境
#   2. 安装 uiautomator2 到该环境
#   3. 创建 lib/ 目录（存放 la.py 等辅助模块）
#
# 注意:
#   - 需要先安装 Python (>=3.8) 并加入 PATH
#   - 推荐从 https://www.python.org/downloads/ 下载安装
#   - 安装时勾选 "Add Python to PATH"
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="${SCRIPT_DIR}/_aienv"
LIB_DIR="${SCRIPT_DIR}/lib"

# ---- 检测 Python ----
PYTHON=""
for cmd in python3 python; do
  if command -v "$cmd" &>/dev/null; then
    PYTHON="$cmd"
    break
  fi
done

if [ -z "$PYTHON" ]; then
  echo "[ERROR] 未找到 python, 请从 https://www.python.org/downloads/ 安装"
  exit 1
fi

echo "[INFO] 使用 Python: $($PYTHON --version)"

# ---- 检测架构 ----
ARCH="$(uname -m)"
echo "[INFO] 系统架构: ${ARCH}"
echo "[INFO] 系统: $(uname -o 2>/dev/null || uname -s)"

# ---- 创建虚拟环境 ----
if [ -d "$VENV_DIR" ]; then
  echo "[INFO] 虚拟环境已存在: ${VENV_DIR}"
else
  echo "[INFO] 创建虚拟环境..."
  "$PYTHON" -m venv "$VENV_DIR"
fi

# ---- 检测 venv 中 python 可执行文件路径 ----
if [ -f "${VENV_DIR}/Scripts/python.exe" ]; then
  VENV_PYTHON="${VENV_DIR}/Scripts/python.exe"
elif [ -f "${VENV_DIR}/bin/python" ]; then
  VENV_PYTHON="${VENV_DIR}/bin/python"
else
  echo "[ERROR] 虚拟环境创建失败, 未找到 python 可执行文件"
  exit 1
fi

echo "[INFO] venv Python: ${VENV_PYTHON}"

# ---- 安装依赖 ----
echo "[INFO] 安装核心依赖..."
"$VENV_PYTHON" -m pip install --upgrade pip -q
"$VENV_PYTHON" -m pip install uiautomator2 -q

echo "[INFO] 安装常用 Python 库..."
"$VENV_PYTHON" -m pip install requests -q
"$VENV_PYTHON" -m pip install pillow -q
"$VENV_PYTHON" -m pip install psutil -q

# ---- 创建 lib 目录 ----
mkdir -p "$LIB_DIR"

echo ""
echo "[DONE] 初始化完成!"
echo ""
echo "  激活环境: source ${VENV_DIR}/Scripts/activate"
echo "  直接运行: ${VENV_PYTHON} your_script.py"
echo "  导入帮助: sys.path.insert(0, '${LIB_DIR}'); import la"
echo ""
echo "  预装库: uiautomator2, requests, pillow, psutil"
echo ""
