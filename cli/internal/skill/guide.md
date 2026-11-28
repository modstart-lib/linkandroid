---
name: linkandroid-cli-skills
description: 通过 LinkAndroid Pro 内置 HTTP 接口或 CLI 命令行工具与本地 LinkAndroid 服务交互。当需要查看已连接设备、管理自动化任务、在脚本中集成 LinkAndroid 能力、或通过命令行操作任务调度时使用本技能。适用场景：自动化脚本管理设备、CI/CD 集成任务调度、终端快速查看设备和任务状态。
---

# LinkAndroid Pro CLI 使用指南

LinkAndroid Pro 提供两种集成方式：**CLI 命令行工具**（适合脚本和终端操作）和 **HTTP 接口**（适合外部程序集成）。

本指南由 CLI 内置，随时可以运行 `linkandroid skill` 查看，不需要启动 LinkAndroid 应用。

---

## 一、CLI 命令行工具

CLI 工具 `linkandroid` 基于 Go 语言开发，通过 Cobra 框架实现，提供简洁的命令行接口。

### 安装

#### 方式一：随应用安装

打开 LinkAndroid Pro，进入 **设置 → CLI 工具** 查看命令与文档。CLI 二进制随安装包提供，也可以自行编译。

#### 方式二：自行编译

```bash
make build-cli
```

编译产物输出到 `dist-cli/`，根据操作系统选择对应的二进制：

| 平台 | 二进制文件 |
|------|-----------|
| macOS ARM64 | `dist-cli/linkandroid-darwin-arm64` |
| macOS Intel | `dist-cli/linkandroid-darwin-x64` |
| Linux ARM64 | `dist-cli/linkandroid-linux-arm64` |
| Linux Intel | `dist-cli/linkandroid-linux-x64` |
| Windows ARM64 | `dist-cli/linkandroid-win-arm64.exe` |
| Windows Intel | `dist-cli/linkandroid-win-x64.exe` |

推荐把二进制重命名为 `linkandroid`（Windows 为 `linkandroid.exe`）并放入 `PATH`，之后即可直接使用 `linkandroid` 命令。

### 前置条件

- 除 `version` 和 `skill` 外，其它命令都需要 LinkAndroid Pro 应用正在运行
- CLI 通过 HTTP 接口与本地服务通信，使用应用自动生成的 Token 认证
- 认证配置文件由 LinkAndroid 在启动时自动写入

### 命令概览

| 命令 | 说明 |
|------|------|
| `linkandroid --help` | 显示帮助信息 |
| `linkandroid version` | 输出版本信息（JSON），不需要启动应用 |
| `linkandroid skill` | 打印本使用指南（Markdown），不需要启动应用 |
| `linkandroid devices` | 列出所有已连接的 Android 设备 |
| `linkandroid task list` | 列出所有任务 |
| `linkandroid task get <id>` | 根据 ID 获取任务详情 |
| `linkandroid task run <id>` | 手动执行任务 |
| `linkandroid task history <id>` | 查看任务运行历史 |

单条命令的实时帮助：

```bash
linkandroid --help
linkandroid task --help
linkandroid task run --help
```

> 除 `skill` 外，命令输出统一为 JSON；`skill` 输出 Markdown。

### 查看版本

```bash
linkandroid version
```

输出示例：

```json
{
  "version": "2.6.0"
}
```

### 列出设备

```bash
linkandroid devices
```

输出示例：

```json
{
  "code": 0,
  "data": [
    {
      "id": "0123456789abcdef",
      "type": "usb",
      "path": null
    },
    {
      "id": "192.168.1.100:5555",
      "type": "wifi",
      "path": null
    }
  ]
}
```

`type` 字段取值：`usb`（USB 连接）、`wifi`（无线连接）、`emulator`（模拟器）。

### 管理任务

#### 列出所有任务

```bash
linkandroid task list
```

输出示例：

```json
{
  "code": 0,
  "data": [
    {
      "id": 1,
      "name": "每日截图任务",
      "description": "每天早上 9 点截图",
      "language": "python",
      "run_mode": "cron",
      "cron_expression": "0 9 * * *",
      "created_at": "2024-01-01T00:00:00.000Z",
      "updated_at": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

#### 获取任务详情

```bash
linkandroid task get 1
```

输出示例：

```json
{
  "code": 0,
  "data": {
    "id": 1,
    "name": "每日截图任务",
    "description": "每天早上 9 点截图",
    "code": "import la\n\ndevice = la.connect()\nscreenshot = device.screenshot()\nscreenshot.save(\"/tmp/screenshot.png\")",
    "language": "python",
    "run_mode": "cron",
    "cron_expression": "0 9 * * *",
    "created_at": "2024-01-01T00:00:00.000Z",
    "updated_at": "2024-01-01T00:00:00.000Z"
  }
}
```

#### 执行任务

```bash
linkandroid task run 1

# 指定设备执行（可选）
linkandroid task run 1 --device 0123456789abcdef
```

输出示例：

```json
{
  "code": 0,
  "data": {
    "runId": 42,
    "log": "任务执行成功\n输出: /tmp/screenshot.png"
  }
}
```

> 说明：任务脚本通过环境变量注入目标设备（`LINKANDROID_DEVICE_ID` / `LINKANDROID_DEVICE_IDS` / `ANDROID_DEVICE_ADDR`），
> 与界面手动执行行为一致。设备解析优先级：
> 1. `--device` 显式指定
> 2. 任务「运行设置」中保存的设备（界面中配置的多设备或「所有设备」）
> 3. 自动选择 adb 第一个在线设备（USB > WiFi > 模拟器）
>
> 若均无在线设备则返回 `NoOnlineDevice` 错误。

#### 查看任务运行历史

```bash
linkandroid task history 1
```

输出示例：

```json
{
  "code": 0,
  "data": [
    {
      "id": 42,
      "task_id": 1,
      "device_id": "0123456789abcdef",
      "status": "success",
      "log": "任务执行成功",
      "started_at": "2024-01-01T09:00:00.000Z",
      "finished_at": "2024-01-01T09:00:05.000Z",
      "created_at": "2024-01-01T09:00:00.000Z",
      "updated_at": "2024-01-01T09:00:05.000Z"
    }
  ]
}
```

`status` 取值：`pending`（等待中）、`running`（运行中）、`success`（成功）、`failed`（失败）。

### 错误处理

CLI 命令输出统一 JSON 格式，判断 `code` 字段：

- `code === 0`：成功，数据在 `data` 字段
- `code !== 0`：失败，错误信息在 `msg` 字段

常见错误：

- `Unauthorized` — 认证 Token 不匹配，重启 LinkAndroid 后重试
- `Task not found` — 任务 ID 不存在
- `Missing task id` — 未提供任务 ID 参数

无法连接本地服务或认证失败时，命令以非 0 退出码结束，并在标准错误输出 `Error: ...`。

---

## 二、HTTP 接口

CLI 工具底层通过 HTTP 接口与 LinkAndroid Pro 交互，也可以直接在脚本或程序中调用这些接口。

### 前提条件

LinkAndroid Pro 应用必须正在运行。应用启动时自动在本地启动 HTTP 服务，监听 `127.0.0.1` 的本地端口（默认 53070，被占用时自动递增），并写入认证文件到 `${dataRoot}/cli-auth.json`。

### 认证

所有接口（除健康检查外）需要 `Authorization: Bearer <token>` 请求头。Token 在应用启动时随机生成，存储在 `cli-auth.json` 中。

配置文件位置：

```
~/.linkandroid/client.json           ← 入口配置（dataRoot）
~/.linkandroid/data/cli-auth.json    ← HTTP 认证信息（port + token）
```

`cli-auth.json` 格式：

```json
{
  "port": 53070,
  "token": "your-auth-token"
}
```

端口默认为 53070，不可用时自动递增。也可以通过环境变量 `LINKANDROID_DATA_ROOT` 指定数据目录（优先级最高）。

### 接口列表

#### 健康检查

```
GET http://127.0.0.1:{port}/
```

无需认证。返回：

```json
{ "code": 0, "msg": "LinkAndroid HTTP API" }
```

#### 列出设备

```
POST http://127.0.0.1:{port}/api/devices
Authorization: Bearer <token>
Content-Type: application/json

{}
```

响应示例：

```json
{
  "code": 0,
  "data": [
    { "id": "0123456789abcdef", "type": "usb", "path": null }
  ]
}
```

#### 列出任务

```
POST http://127.0.0.1:{port}/api/task/list
Authorization: Bearer <token>
Content-Type: application/json

{}
```

#### 获取任务详情

```
POST http://127.0.0.1:{port}/api/task/get
Authorization: Bearer <token>
Content-Type: application/json

{ "id": "1" }
```

#### 执行任务

```
POST http://127.0.0.1:{port}/api/task/run
Authorization: Bearer <token>
Content-Type: application/json

{ "id": 1 }
```

可选参数：

- `deviceId`：指定目标设备 ID（不传时自动选择 adb 第一个在线设备，USB 优先；无在线设备返回 `NoOnlineDevice`）

```
{ "id": 1, "deviceId": "0123456789abcdef" }
```

响应：

```json
{
  "code": 0,
  "data": {
    "runId": 42,
    "log": "..."
  }
}
```

#### 查看任务运行历史

```
POST http://127.0.0.1:{port}/api/task/history
Authorization: Bearer <token>
Content-Type: application/json

{ "id": "1" }
```

### 错误处理

所有接口返回统一格式：

- 成功：`{ "code": 0, "data": ... }`
- 失败：`{ "code": -1, "msg": "错误描述" }`
- 认证失败：HTTP 401 + `{ "code": -1, "msg": "Unauthorized" }`
- 未找到：HTTP 404 + `{ "code": -1, "msg": "Task not found" }`

---

## 三、脚本集成示例

### Shell 脚本

```bash
#!/bin/bash
# 读取认证信息
AUTH_FILE="$HOME/.linkandroid/data/cli-auth.json"
PORT=$(jq -r '.port' "$AUTH_FILE")
TOKEN=$(jq -r '.token' "$AUTH_FILE")

# 列出设备
curl -s -X POST "http://127.0.0.1:$PORT/api/devices" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### 直接使用 CLI

```bash
# 编译 CLI
make build-cli

# 查看完整使用指南
./dist-cli/linkandroid-darwin-arm64 skill

# 查看设备
./dist-cli/linkandroid-darwin-arm64 devices

# 执行任务
./dist-cli/linkandroid-darwin-arm64 task run 1
```

---

> 本指南随 CLI 版本内置。如与 `linkandroid --help` 的单条命令帮助不一致，以 `--help` 为准。
