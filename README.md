# 幻语 AI · 开源免费的 AI 角色扮演聊天应用

一个像「猫香」「冒泡鸭」「星野」那样，可以和不同 AI 角色自由聊天的应用。完全免费、可离线使用、可本地部署、支持任意 OpenAI 兼容接口，数据全部保存在你自己的设备上。

- 手机端：提供 Android APK 安装包
- 桌面端：一行脚本启动，浏览器即开即用
- 开源：MIT 协议，代码完全开放

## 功能特性

- **免费离线聊天**：内置角色扮演对话引擎，无需网络、无需 API、无需任何费用
- **丰富角色卡**：内置 8 套精心设计的人设，支持一键新建、编辑自己的角色
- **角色扮演引擎**：意图识别 + 人设模板 + 记忆画像，让离线对话也生动自然
- **多模型接口**：支持 Ollama 本地模型、任意 OpenAI 兼容接口（DeepSeek / 通义 / GLM / OpenAI 等）
- **多轮对话**：每个角色可创建多段独立对话，随时切换、重命名、删除
- **语音朗读**：调用系统 TTS，免费离线朗读
- **个性头像**：渐变头像 / 上传图片头像
- **记忆画像**：角色会记住你提过的话题和喜好
- **数据自主**：所有数据仅存本机，支持一键备份 / 恢复 / 清空
- **界面美观**：深色 / 浅色双主题，移动端优先，PWA 可安装到桌面

## 快速开始

### 手机安装（Android APK）

1. 一键构建脚本会产出安装包到 `dist/幻语AI-v1.0.0.apk`：

   ```bash
   bash scripts/build-apk.sh
   ```

2. 将 APK 传到手机，允许「安装未知来源应用」后安装即可
3. 打开即可直接和内置角色聊天，无需任何配置

### 桌面版

```bash
bash scripts/desktop.sh
```

脚本会自动安装依赖、构建前端、启动本地服务并打开浏览器（默认 http://localhost:3001）。

### 本地部署（局域网 / 服务器）

```bash
# 1. 构建前端
cd web && npm install && npm run build

# 2. 启动服务（默认端口 3001）
cd server && npm install && npm start
```

局域网内其他设备可通过 `http://服务器IP:3001` 访问。如需服务端代理大模型接口，编辑 `server/config.json`：

```json
{
  "provider": "openai",
  "baseUrl": "https://api.deepseek.com/v1",
  "apiKey": "你的Key",
  "model": "deepseek-chat"
}
```

也可用环境变量 `HY_BASE_URL`、`HY_API_KEY`、`HY_MODEL` 覆盖。

## 对话引擎配置

打开 App「设置」，三种引擎任选：

| 引擎 | 说明 | 费用 |
|------|------|------|
| 本地内置对话 | 开箱即用，无需任何接口，完全离线 | 免费 |
| Ollama 本地模型 | 连接自己电脑的 Ollama，数据不出本机 | 免费 |
| OpenAI 兼容接口 | 填入接口地址 / Key / 模型名 | 取决于你的接口 |

### Ollama 说明

1. 电脑安装并运行 Ollama：`ollama serve`
2. 拉取模型：`ollama pull qwen2.5:7b`
3. 手机与电脑同一 Wi-Fi，设置里填 `http://电脑局域网IP:11434/v1`

> 若浏览器访问 Ollama 被 CORS 拦截，可用 `OLLAMA_ORIGINS=* ollama serve` 启动，或直接使用桌面版 / 服务端代理。

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

## 目录结构

```
web/       前端应用（Vue 3 + Vite + Capacitor）
server/    本地部署服务（Express，静态托管 + 可选接口代理）
android/   由 Capacitor 生成的 Android 工程（位于 web/android）
scripts/   构建脚本（APK 一键构建、桌面版启动、图标生成）
dist/      构建产物输出目录（含 APK 安装包）
```

## 合规说明

- 本应用不收集、不上传任何用户数据，所有数据仅保存在本机
- AI 回复由程序或用户自配模型生成，仅供娱乐，不构成任何专业建议
- 请遵守你所使用模型服务的相关条款，勿用于违法违规用途

## License

MIT
