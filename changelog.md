## [Unreleased]

## v1.1.0 Enhanced Wireless Pairing & Side Toolbar

### Release Summary
**LinkAndroid v1.1.0** brings revolutionary wireless pairing capabilities and enhanced mirroring controls. Experience seamless device connections with QR code auto-pairing, automatic mDNS discovery, and an intuitive side toolbar for screen mirroring operations. This update significantly improves the wireless debugging workflow and user experience across all platforms.

**Key Highlights:**
- **One-Scan Connection**: QR code pairing with automatic device discovery
- **Mirroring Toolbar**: Quick access controls during screen mirroring
- **Smart Discovery**: Bonjour-based mDNS for effortless device finding
- **Multi-Device Sync**: Follow and top modes for synchronized operations

---

### Major Features
- **Enhanced Wireless Pairing**: Complete overhaul of wireless debugging with QR code auto-pairing and manual pairing code input
- **mDNS Service Discovery**: Automatic device discovery using Bonjour for seamless ADB connections
- **Side Toolbar for Mirroring**: Quick access toolbar during screen mirroring with Back, Home, Recent, Volume, and Screenshot controls
- **Device Connection Menu**: Dropdown menu for rapid network device connections and wireless debugging pairing

### Technical Improvements
- **Core Upgrade**: scrcpy upgraded to v3.3.4 for enhanced mirroring stability
- **Path Management**: Simplified ADB and Scrcpy binary path handling with intelligent defaults
- **UI/UX Enhancements**: Improved wireless pairing dialogs, loading animations, and multilingual consistency
- **Network Detection**: Automatic network interface detection for wireless pairing

### Bug Fixes & Optimizations
- Fixed mirroring failures when installation paths contain Chinese characters
- Added force quit functionality in tray configuration
- Optimized splash screen layout and transparency settings
- Enhanced Pro version feature guidance and upgrade prompts
- Improved internationalization with comprehensive translation updates

### Device Features
- Follow mode and top mode for synchronized multi-device mirroring operations
- Automatic device scanning and connection after QR code pairing
- Enhanced device search and connection workflows

---

## v1.1.0 增强无线配对与投屏操作栏

### 版本概要
**LinkAndroid v1.1.0** 带来革命性的无线配对能力和增强的投屏控制体验。通过二维码自动配对、自动mDNS发现和直观的投屏侧边操作栏，实现无缝设备连接。本次更新显著提升了无线调试工作流和跨平台用户体验。

**主要亮点：**
- **一扫即连**：二维码配对配合自动设备发现
- **投屏工具栏**：投屏时快捷操作控制
- **智能发现**：基于Bonjour的mDNS轻松发现设备
- **多设备同步**：随动和置顶模式实现同步操作

### 主要功能
- **增强无线配对**：全新无线调试体验，支持二维码自动配对和手动配对码输入
- **mDNS服务发现**：使用Bonjour自动发现设备，实现ADB无缝连接
- **投屏侧边操作栏**：投屏时快捷操作栏，支持返回、首页、最近任务、音量调节、截图等操作
- **设备连接菜单**：下拉菜单支持快速网络设备连接及无线调试配对

### 技术改进
- **核心升级**：scrcpy升级至v3.3.4，提升投屏稳定性
- **路径管理**：简化ADB和Scrcpy二进制路径处理，智能默认路径
- **界面优化**：改进无线配对对话框、加载动画、多语言一致性
- **网络检测**：自动网络接口检测，用于无线配对

### 修复与优化
- 修复安装路径包含中文时投屏可能失败的问题
- 在托盘配置中添加强制退出功能
- 优化启动画面布局和透明度设置
- 增强Pro版本功能引导与升级提示流程
- 完善国际化翻译更新

### 设备功能
- 设备投屏随动模式和置顶模式，支持多设备同步操作
- 二维码配对后自动扫描和连接设备
- 增强设备搜索和连接工作流

---

## v1.0.0 正式版发布，布局调整设计，内置依赖，支持设备搜索


## v1.0.0 正式版发布，布局调整设计，内置依赖，支持设备搜索

- 新增：窗口顶部点击最大化
- 新增：Mac版本默认集成scrcpy，不再依赖外部
- 新增：设备搜索功能，支持按设备名称搜索
- 升级：升级 scrcpy 至最新版
- 优化：scrcpy 和 adb 二进制路径优化
- 优化：命令调用方式优化
- 优化：设备批量显示布局优化

## v0.7.0 系统兼容性提升，底层基础库优化

- 新增：请求重试功能，避免查询失败问题
- 新增：基础库函数功能升级
- 修复：windows 11 最新版本获取系统信息异常
- 修复：多语言参数为0时异常问题
- 优化：主窗口界面 Mac 支持信号灯按钮
- 优化：Toast 弹窗字体设置，避免字体丢失显示异常问题

## v0.6.0 新版本检测支持，部分已知问题修复

- 新增：启动新版本检测，支持新版本检测开关
- 新增：用户接口请求支持异常捕获配置 catchException
- 优化：文件追加方法缓存优化
- 优化：弹窗父窗口逻辑优化
- 修复：设备名称不可修改问题
- 修复：文件重命名跨设备异常问题

## v0.5.0 投屏自定义参数，支持Arm64架构adb

- 新增：时间戳获取方法
- 新增：集成 arm64 架构 adb（ 二进制包来自 prife/adb ）
- 新增：投屏自定义参数支持，方便个性化设置
- 优化：投屏失败弹出错误图示对话框
- 优化：Linux 平台获取 UUID 方法优化

## v0.4.0 投屏时关闭屏幕，工单反馈，文件夹下载，已知问题修复

- 新增：投屏时关闭屏幕
- 新增：工单反馈功能，便于解决问题
- 新增：应用 loading 窗口
- 新增：添加文件夹下载功能 [#pr-43](https://github.com/modstart-lib/linkandroid/pull/43)
- 优化：请求异常时增加错误码
- 优化：系统未捕获异常日志记录
- 优化：工单提交日志收集完善更多信息，方便排查问题
- 优化：将已连接的设备排在最前面，剩下的按照id排序 [#pr-42](https://github.com/modstart-lib/linkandroid/pull/42/files)
- 优化：toast 和 loading 显示位置优化
- 优化：修复文件管理页面的输入窗口焦点问题 [#pr-44](https://github.com/modstart-lib/linkandroid/pull/44)
- 修复：windows下路径编码问题
- 修复：版本号对比检测异常问题修复

## v0.3.0

- 新增：支持设置投屏视频比特率和刷新率
- 新增：调试窗口统一管理，方便查看调试信息
- 增加：构建版本时间序列号
- 优化：Mac 打包增加自建证书，避免安装提示被损坏问题
- 优化：跨页面调用方式优化
- 优化：投屏时默认调用内置 adb ，避免找不到 adb 路径问题
- 优化：命令行解析优化

## v0.2.0

- 新增：暗黑模式支持，支持自动切换系统主题
- 修复：命令行中带有空格的参数无法执行问题
- 修复：最小化最大化不能点击问题

## v0.1.0

- 新增：增加设备全局默认配置界面，手机设置界面可继承全局配置
- 新增：增加视频播放组件
- 新增：显示预览图全局开关和设备配置开关
- 优化：Mac 系统下全屏不能退出问题
- 优化：Mac 系统下隐藏窗口自动隐藏图标
- 优化：手机投屏后自动禁止锁屏
- 优化：默认禁用 GPU 加速功能
- 优化：Windows 系统下进程输出编码乱码问题
- 优化：Windows 系统下界面阴影问题，避免和白色背景冲突
- 优化：Windows 系统下启动画面窗口任务栏隐藏
- 优化：beta 打包版本号显示优化，方便区分不同 snapshot 版本
- 优化：软件顶部隐藏版本号显示

## v0.0.12

- 新增：日志目录一键打开，方便查看日志
- 新增：本地日志默认保留14天，超过14天自动删除
- 新增：投屏总在最上层设置
- 新增：投屏时转发声音到电脑设置
- 新增：投屏时调暗屏幕设置
- 优化：问题反馈链接直达反馈页面
- 优化：配置页面逻辑功能优化
- 优化：快捷键优化重构修改
- 优化：窗口隐藏时，点击图标显示窗口
- 优化：Windows 系统下，点击任务栏图标显示窗口
- 优化：投屏部分功能重构，页面切换投屏状态不消失
- 修复：快捷键全局注册其他软件失效问题
- 修复：命令执行返回结果为空时异常显示

## v0.0.11

- 新增：软件退出时，增加记住选择选项
- 新增：英文截图配图
- 优化：优化mac托盘图标显示

## v0.0.10

- 新增：断开网络设备端口功能，关闭adb打开的 5555 端口
- 新增：已投屏设备再次点击投屏关闭投屏
- 优化：投屏窗口取消置顶
- 优化：用户头像功能显示

## v0.0.9

- 优化：设备操作按钮根据设备类型和状态显示调整

## v0.0.8

- 新增：增加设备连接向导功能
- 新增：增加设备类型区分，USB 和 网络
- 优化：多语言功能优化
- 优化：adb 在软件关闭时不自动断开
- 修复：投屏弹出多个成功提示框

## v0.0.7

- 新增: 增加设备置顶功能，便于排序
- 新增：截图增加图片美化功能

## v0.0.6

- 优化：功能迭代

## v0.0.5

- 优化：功能迭代

## v0.0.4

- 优化：功能迭代

## v0.0.3

- 优化：功能迭代

## v0.0.2

- 优化：功能迭代

## v0.0.1

- 优化：第一个正式版本发布
