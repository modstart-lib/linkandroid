#!/usr/bin/env bash
#
# init-linux.sh — Linux 初始化 Python 虚拟环境 (arm64 / x86_64 / riscv64)
#
# 用法:
#   chmod +x init-linux.sh && ./init-linux.sh
#
# 作用:
#   1. 自动检测系统包管理器并确保 python3-venv 已安装
#   2. 在当前目录创建 _aienv/ 虚拟环境
#   3. 安装 uiautomator2 到该环境
#   4. 创建 lib/ 目录（存放 la.py 等辅助模块）
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="${SCRIPT_DIR}/_aienv"
LIB_DIR="${SCRIPT_DIR}/lib"

# ---- 检测 Python ----
PYTHON=""
for cmd in python3.12 python3.11 python3.10 python3; do
  if command -v "$cmd" &>/dev/null; then
    PYTHON="$cmd"
    break
  fi
done

if [ -z "$PYTHON" ]; then
  echo "[ERROR] 未找到 python3, 请先安装:"
  echo "  Debian/Ubuntu: sudo apt install python3"
  echo "  CentOS/RHEL:   sudo yum install python3"
  echo "  Alpine:        sudo apk add python3"
  exit 1
fi

PYTHON_BIN="$(command -v "$PYTHON")"
echo "[INFO] 使用 Python: $($PYTHON --version)  ($PYTHON_BIN)"

# ---- 检测架构 ----
ARCH="$(uname -m)"
echo "[INFO] 系统架构: ${ARCH}"

# ---- 确保 python3-venv 可用 ----
VENV_MODULE_CHECK="$("$PYTHON" -c "import venv" 2>&1 || true)"
if echo "$VENV_MODULE_CHECK" | grep -qi "no module"; then
  echo "[INFO] 安装 python3-venv..."
  if command -v apt &>/dev/null; then
    sudo apt update -qq && sudo apt install -y -qq python3-venv python3-pip
  elif command -v yum &>/dev/null; then
    sudo yum install -y python3-venv python3-pip
  elif command -v apk &>/dev/null; then
    sudo apk add py3-venv py3-pip
  else
    echo "[ERROR] 不支持的包管理器, 请手动安装 python3-venv"
    exit 1
  fi
  # 重新检测 venv
  "$PYTHON" -c "import venv" 2>/dev/null || {
    echo "[ERROR] python3-venv 安装后仍不可用, 请手动检查"
    exit 1
  }
fi

# ---- 创建虚拟环境 ----
if [ -d "$VENV_DIR" ]; then
  echo "[INFO] 虚拟环境已存在: ${VENV_DIR}"
else
  echo "[INFO] 创建虚拟环境..."
  "$PYTHON" -m venv "$VENV_DIR"
fi

# ---- 激活并安装依赖 ----
echo "[INFO] 安装核心依赖..."
"${VENV_DIR}/bin/python" -m pip install --upgrade pip -q
"${VENV_DIR}/bin/python" -m pip install uiautomator2 -q

echo "[INFO] 安装常用 Python 库..."
"${VENV_DIR}/bin/python" -m pip install requests -q
"${VENV_DIR}/bin/python" -m pip install pillow -q
"${VENV_DIR}/bin/python" -m pip install psutil -q

# ---- 创建 lib 目录 ----
mkdir -p "$LIB_DIR"

echo ""
echo "[DONE] 初始化完成!"
echo ""
echo "  激活环境: source ${VENV_DIR}/bin/activate"
echo "  直接运行: ${VENV_DIR}/bin/python your_script.py"
echo "  导入帮助: sys.path.insert(0, '${LIB_DIR}'); import la"
echo ""
echo "  预装库: uiautomator2, requests, pillow, psutil"
echo ""
