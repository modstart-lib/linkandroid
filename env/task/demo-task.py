"""
demo-script.py — 使用 la 库控制 Android 手机的示例

运行方式:
    ./env/script/_aienv/bin/python env/script/demo-script.py

或者先激活虚拟环境:
    source env/script/_aienv/bin/activate
    python env/script/demo-script.py
"""
import sys
import os

# 将 lib 目录加入导入路径, 这样才能 import la
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(SCRIPT_DIR, "lib"))

import la


def main():
    # 1. 连接设备 (默认 127.0.0.1, 可通过环境变量 ANDROID_DEVICE_ADDR 覆盖)
    print("=== 连接设备 ===")
    d = la.connect()
    print(f"  设备: {d.serial}")
    print(f"  屏幕: {la.width()}x{la.height()}")

    # 2. 获取设备信息
    print("\n=== 设备信息 ===")
    info = la.deviceInfo()
    print(f"  品牌: {info.get('brand')}")
    print(f"  型号: {info.get('productName')}")
    print(f"  Android: {info.get('apiLevel')}")
    print(f"  电池: {la.battery()}")

    # 3. 返回桌面
    print("\n=== 回到桌面 ===")
    la.home()
    la.sleep(1)

    # 4. 打开设置应用 (com.android.settings)
    print("\n=== 打开设置 ===")
    la.appStart("com.android.settings")
    la.sleep(2)

    # 5. 截屏
    print("\n=== 截屏 ===")
    screenshot_path = os.path.join(SCRIPT_DIR, "_screenshot_demo.png")
    la.screenshot(screenshot_path)
    print(f"  截图已保存: {screenshot_path}")

    # 6. 获取 UI 层次
    print("\n=== UI 层次 (前500字符) ===")
    xml = la.dumpHierarchy()
    print(f"  {xml[:500]}...")

    # 7. 滑动操作
    print("\n=== 上滑 ===")
    la.swipeExt("up", scale=0.6)
    la.sleep(1)

    # 8. 点击文本 (如果存在)
    print("\n=== 尝试点击 '关于手机' ===")
    found = la.clickText("关于手机", timeout=3)
    print(f"  点击结果: {'成功' if found else '未找到'}")

    # 9. 返回
    la.sleep(1)
    print("\n=== 返回桌面 ===")
    la.home()

    print("\n=== 示例结束 ===")


if __name__ == "__main__":
    main()
