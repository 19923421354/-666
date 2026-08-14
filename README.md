# 星语 AI · Xingyu AI

[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.5.0-purple)](https://github.com/19923421354/xingyu/releases)
[![Vue](https://img.shields.io/badge/Vue-3.x-42b883.svg)](https://vuejs.org)
[![Platform](https://img.shields.io/badge/Platform-Android%20%7C%20Web-lightgrey.svg)]()

一个像「猫香」「冒泡鸭」「星野」那样，可以和不同 AI 角色自由聊天的开源应用。完全免费、可离线使用、可本地部署、支持任意 OpenAI 兼容接口，数据全部保存在你自己的设备上。

- **手机端**：提供 Android APK 安装包
- **桌面端**：一行脚本启动，浏览器即开即用
- **开源**：MIT 协议，代码完全开放

---

## 目录

- [功能特性](#功能特性)
- [快速开始](#快速开始)
- [对话引擎](#对话引擎配置)
- [开发指南](#开发)
- [目录结构](#目录结构)
- [常见问题](#常见问题-faq)
- [贡献](#贡献)
- [合规与隐私](#合规说明)
- [License](#license)

---

## 功能特性

| 分类 | 功能 |
|------|------|
| 本地 AI | 内置 Qwen2.5-0.5B 模型，设备端离线推理，免费无网络 |
| 角色生态 | 22 套内置人设、角色模板库、标签分类、导入 / 导出角色卡 |
| 对话体验 | 会话收藏与置顶、快捷回复、快捷短语、表情反应、消息编辑重生成 |
| 输入能力 | 语音输入、输入草稿自动保存、代码块一键复制 |
| 记忆系统 | 智能总结沉淀长期记忆，让角色越来越懂你 |
| 趣味功能 | 今日运势、随机缘分「抽一个」、聊天统计与连续打卡 |
| 个性化 | 8 套主题色、字体大小、三种气泡样式、跟随系统 / 深色 / 浅色主题 |
| 朗读 | 系统 TTS 离线朗读，语速音调可调 |
| 搜索 | 跨角色全局搜索消息，一键跳转定位 |
| 数据 | 全本地存储，一键备份 / 恢复 / 清空，存储占用可视化 |
| 性能 | 路由懒加载 + 代码分包，启动更快 |

---

## 快速开始

### 手机安装（Android APK）

```bash
bash scripts/build-apk.sh
```

产物输出到 `dist/星语AI-v1.5.0.apk`，传到手机安装（需允许「安装未知来源应用」）即可直接使用。

### 桌面版

```bash
bash scripts/desktop.sh
```

脚本自动安装依赖、构建前端、启动本地服务并打开浏览器（默认 http://localhost:3001）。

### 本地部署（局域网 / 服务器）

```bash
# 1. 构建前端
cd web && npm install && npm run build

# 2. 启动服务（默认端口 3001）
cd server && npm install && npm start
```

局域网内其他设备通过 `http://服务器IP:3001` 访问。如需服务端代理大模型接口，编辑 `server/config.json`：

```json
{
  "provider": "openai",
  "baseUrl": "https://api.deepseek.com/v1",
  "apiKey": "你的Key",
  "model": "deepseek-chat"
}
```

也可用环境变量 `XY_BASE_URL`、`XY_API_KEY`、`XY_MODEL` 覆盖。

---

## 对话引擎配置

打开 App「设置」，四种引擎任选：

| 引擎 | 说明 | 费用 |
|------|------|------|
| 星语内置 AI | 内置 Qwen2.5-0.5B 模型，设备本地推理，完全离线（默认） | 免费 |
| 轻量对话 | 意图识别 + 人设模板的离线引擎，秒回，无需模型 | 免费 |
| Ollama 本地模型 | 连接自己电脑的 Ollama，数据不出本机 | 免费 |
| OpenAI 兼容接口 | 填入接口地址 / Key / 模型名 | 取决于你的接口 |

> 内置模型约 1.3GB（fp16 存储）。首次打开使用内置 AI 时会解压加载，约需 10~30 秒，之后更快。

### 内置模型说明

- 模型：Qwen2.5-0.5B-Instruct（fp16 存储 ONNX，约 1.3GB）
- 运行：transformers.js + onnxruntime-web（WASM / WebGPU），浏览器 / WebView 内直接推理
- 加速：设备支持 WebGPU 时自动启用 GPU 推理，否则回退 CPU（WASM）
- 隐私：推理完全在本机进行，不产生任何网络请求
- 硬件要求：Android 8+ 或现代浏览器，建议内存 2GB 以上；慢速设备请改用「轻量对话」

### Ollama 说明

1. 电脑安装并运行 Ollama：`ollama serve`
2. 拉取模型：`ollama pull qwen2.5:7b`
3. 手机与电脑同一 Wi-Fi，设置里填 `http://电脑局域网IP:11434/v1`

> 若浏览器访问 Ollama 被 CORS 拦截，可用 `OLLAMA_ORIGINS=* ollama serve` 启动，或直接使用桌面版 / 服务端代理。

---

## 开发

```bash
# 前端开发
cd web && npm install && npm run dev

# 构建 Android APK（需 JDK 17 + Android SDK）
bash scripts/build-apk.sh
# 或手动：
cd web && npx cap add android && npx cap sync
cd android && ./gradlew assembleRelease
```

> 注意：`npm install` 时若 onnxruntime-node 下载失败（网络受限环境），可改用 `npm install --ignore-scripts`，浏览器 / WebView 运行不依赖原生 onnxruntime-node。

---

## 目录结构

```
web/       前端应用（Vue 3 + Vite + Capacitor）
server/    本地部署服务（Express，静态托管 + 可选接口代理）
scripts/   构建脚本（APK 一键构建、桌面版启动、图标生成）
dist/      构建产物输出目录（含 APK 安装包）
```

---

## 常见问题 (FAQ)

**Q：内置 AI 模型从哪里下载？**
首次使用内置 AI 时自动从 `web/public/models` 加载，模型权重为可下载资产，不纳入版本库。可运行 `bash scripts/download-model.sh` 预先下载。

**Q：数据存在哪里？会不会被上传？**
所有数据（角色、对话、记忆、设置）只保存在设备本地（localStorage），不收集、不上传任何个人信息。

**Q：用 OpenAI 兼容接口安全吗？**
Key 只保存在本机浏览器存储中，仅在请求时随请求发出，不会上传到任何第三方。

**Q：慢速设备运行卡顿怎么办？**
在设置中切换到「轻量对话」离线引擎，秒回且无需加载模型。

**Q：如何给角色打标签？**
编辑角色 → 角色标签 → 输入标签回车（或点击下方推荐标签）。首页顶部会出现标签筛选栏。

---

## 贡献

欢迎任何形式的贡献！请先阅读 [CONTRIBUTING.md](CONTRIBUTING.md) 和 [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)。

- 🐛 报告 Bug：通过 [GitHub Issues](https://github.com/19923421354/xingyu/issues) 提交
- ✨ 提交功能：Fork 后提交 Pull Request
- 💡 新角色预设：欢迎在 PR 中补充内置角色卡

---

## 合规说明

- 本应用不收集、不上传任何用户数据，所有数据仅保存在本机
- AI 回复由程序或用户自配模型生成，仅供娱乐，不构成任何专业建议
- 请遵守你所使用模型服务的相关条款，勿用于违法违规用途

---

## License

[MIT](LICENSE) © 2026 星语 AI
