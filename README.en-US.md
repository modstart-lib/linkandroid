<div align="center">
  <img src="demo/image/home.png" alt="LinkAndroid Banner" width="800" />
</div>

<h1 align="center">LinkAndroid — All-in-One Android Phone Connection Assistant</h1>

<div align="center">
  <a href="https://linkandroid.com" target="_blank">
    <img src="https://img.shields.io/badge/Web-linkandroid.com-blue?style=flat-square" alt="Website" />
  </a>
  <img src="https://img.shields.io/badge/Framework-TS%20%7C%20Vue3%20%7C%20Electron-blue?style=flat-square" alt="Framework" />
  <a href="https://github.com/modstart-lib/linkandroid" target="_blank">
    <img src="https://img.shields.io/github/stars/modstart-lib/linkandroid.svg?style=flat-square" alt="GitHub Stars" />
  </a>
  <a href="https://gitee.com/modstart-lib/linkandroid" target="_blank">
    <img src="https://gitee.com/modstart-lib/linkandroid/badge/star.svg?style=flat-square" alt="Gitee Stars" />
  </a>
  <a href="https://gitcode.com/modstart-lib/linkandroid" target="_blank">
    <img src="https://gitcode.com/modstart-lib/linkandroid/star/badge.svg?style=flat-square" alt="GitCode Stars" />
  </a>
  <br/>
  <strong>English</strong> · <a href="./README.md">简体中文</a>
</div>

<p align="center">
  <strong>LinkAndroid</strong> is a cross-platform desktop application built with Electron that seamlessly connects your Android devices to your computer. After connecting via USB or Wi-Fi, you can <strong>screen mirror with keyboard/mouse control, capture and beautify screenshots, record GIF/MP4 screencasts, manage files and apps, run ADB Shell commands, automate tasks with Python scripts, and integrate 47+ AI models</strong> — all from one unified interface.
</p>

<p align="center">
  <b>🚀 Open Source · Cross-Platform · Powerful · Easy to Use</b>
</p>

---

## 📦 Installation

| Platform | Instructions |
|----------|-------------|
| **Windows** | Download the installer from [linkandroid.com](https://linkandroid.com) and install with one click |
| **macOS** | Download the DMG from [linkandroid.com](https://linkandroid.com) and install with one click |
| **Linux** | Download the AppImage from [linkandroid.com](https://linkandroid.com) and install with one click |

---

## ✨ Features

### 🔗 Multi-Device Connection & Management

Connect multiple Android devices simultaneously via USB or Wi-Fi with flexible pairing options.

![Device List](demo/image/device.png)

- **USB Plug & Connect** — Auto-detect devices plugged in via USB
- **Wireless QR Pairing** — Scan a QR code to pair over Wi-Fi
- **Pairing Code** — Enter a 6-digit code for quick pairing
- **Wi-Fi Direct** — Connect manually via IP:port
- **mDNS Auto-Discovery** — Automatically scan your LAN for Android devices
- **Device Grouping** — Organize devices into groups for fast filtering

| QR Pairing | Pairing Code | Group Management |
|:----------:|:------------:|:----------------:|
| ![Wireless QR Pairing](demo/image/device-wireless-pairing.png) | ![Pairing Code](demo/image/device-pairing-code.png) | ![Device Groups](demo/image/device-group-select.png) |

### 🖥️ Screen Mirroring & Control (Scrcpy)

Low-latency screen mirroring powered by [scrcpy](https://github.com/Genymobile/scrcpy). Full keyboard and mouse input forwarding for controlling your phone directly from your computer.

- **One-Click Mirror** — High-quality, low-latency screen casting
- **Reverse Control** — Use your keyboard and mouse to interact with your phone
- **OTG Mode** — Turn your PC into a keyboard/mouse emulator
- **Camera Streaming** — Stream your phone's camera with selectable resolution and FPS
- **Follow Mode** — Sync operations across multiple devices
- **Adjustable Settings** — Bitrate, framerate, always-on-top, window border, and more

| Camera Stream | Mirror Settings |
|:-------------:|:--------------:|
| ![Camera](demo/image/device-camera.png) | ![Mirror Settings](demo/image/device-setting.png) |

### 📸 Screenshot with Beautifier

Take screenshots with a single click, then instantly open the built-in beautifier to add device frames, gradient backgrounds, and polish — perfect for sharing on social media.

### 🎥 GIF / MP4 Screen Recording

Record your phone screen in **MP4** or **GIF** format with customizable duration and quality. Ideal for demos, tutorials, and bug reproduction.

![Screen Recording](demo/image/device-record.png)

### 📁 File Manager

A full-featured file browser for your Android device. Upload, download, delete, and rename files directly from your desktop. Switch between list and grid views, sort by name, date, or size.

![File Manager](demo/image/device-file-manager.png)

### 📱 App Manager

Browse installed apps with icons, batch uninstall applications, or install APK files via the built-in file picker. Manage everything on your phone without touching the phone.

### 💻 Command Terminal

Built-in **ADB Shell** terminal with a quick-access command palette. Run adb commands and Android shell commands with ease. Commonly used commands are one click away.

| ADB Shell | Command Palette |
|:---------:|:--------------:|
| ![ADB Shell](demo/image/device-adb-shell.png) | ![Shell Tool](demo/image/device-shell-tool.png) |

### 🤖 Script Automation

Write and execute Python automation scripts for batch operations and workflow automation across one or multiple devices.

- **Visual Code Editor** — Built-in editor with syntax highlighting (CodeMirror 6)
- **Cron Scheduling** — Schedule tasks to run automatically using cron expressions
- **Multi-Device Execution** — Run the same task across multiple devices simultaneously
- **Run Logs** — Full execution history with detailed logs
- **HTTP API** — Trigger tasks remotely via REST API (port 53030)

| Task List | Task Editor |
|:---------:|:----------:|
| ![Task Management](demo/image/task.png) | ![Task Editor](demo/image/task-editor.png) |

### 🌐 CLI Remote Control & HTTP API

The built-in HTTP server provides a RESTful API for remote control and CI/CD integration:

| Endpoint | Description |
|----------|-------------|
| `POST /api/devices` | List connected devices |
| `POST /api/task/list` | List all tasks |
| `POST /api/task/get` | Get task by ID |
| `POST /api/task/run` | Trigger a task remotely |
| `POST /api/task/history` | View task execution history |

Bearer Token authentication is supported for secure access.

### 🧠 AI Model Integration

Built-in support for **47+ AI model providers**, including OpenAI, DeepSeek, Zhipu AI, Alibaba Qwen, local Ollama, Anthropic Claude, Google Gemini, and many more.

- **Unified Management** — Manage API keys and model configurations for all providers in one place
- **AI-Assisted Coding** — Generate task scripts with AI help directly in the task editor
- **Flexible Prompts** — Configure prompt parameters, temperature, and more

![Model Settings](demo/image/setting-model.png)

### 🌍 Internationalization (i18n)

Supports **English** and **Simplified Chinese** with automatic language detection based on system preferences — no manual configuration needed.

### 🌗 Dark Mode

Choose from **Light**, **Dark**, or **Follow System** themes for a comfortable viewing experience in any environment.

---

## 🖼️ More Screenshots

| Default Device Settings | Wi-Fi Connection | Settings | About |
|:----------------------:|:----------------:|:--------:|:-----:|
| ![Default Settings](demo/image/device-default-setting.png) | ![Connect WiFi](demo/image/device-connect-wifi.png) | ![Settings](demo/image/setting.png) | ![About](demo/image/setting-about.png) |

---

## 🚀 Development

> Tested with **Node.js 20** only.

```bash
# Clone the repository
git clone https://github.com/modstart-lib/linkandroid.git
cd linkandroid

# Install dependencies
npm install

# Start development mode (launches Electron window)
npm run dev

# Build for production
npm run build

# Preview build (Vite build only, no packaging)
npm run build:preview
```

### Available Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server + Electron |
| `npm run dev:mac` | Kill existing process, then start dev mode (macOS) |
| `npm run build:preview` | Code format check + Vite build |
| `npm run build` | Full build + electron-builder packaging |
| `npm run build:mac` | Package for macOS |
| `npm run build:win` | Package for Windows |
| `npm run build:linux` | Package for Linux |
| `npm run format` | Format code with Prettier |

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 💬 Community

> When adding a friend, please leave a note: **LinkAndroid**

| WeChat Group | QQ Group |
|:------------:|:--------:|
| <img src="https://open.tecmz.com/code_dynamic/wx" width="200" alt="WeChat Group" /> | <img src="https://open.tecmz.com/code_dynamic/qq" width="200" alt="QQ Group" /> |

---

## 📄 License

This project is licensed under the [Apache-2.0](./LICENSE) License.
