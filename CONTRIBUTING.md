# 贡献指南

感谢你愿意为星语 AI 贡献力量！无论是指出问题、提交代码、补充角色预设还是完善文档，都非常欢迎。

## 目录

- [如何参与](#如何参与)
- [环境准备](#环境准备)
- [开发流程](#开发流程)
- [代码规范](#代码规范)
- [提交 PR](#提交-pr)
- [新增角色预设](#新增角色预设)
- [报告问题](#报告问题)

## 如何参与

- **提 Bug**：通过 [Issues](https://github.com/19923421354/xingyu/issues) 提交，请附上复现步骤与截图
- **提功能建议**：同样通过 Issues，用「功能建议」标签
- **写代码**：Fork 仓库 → 新建分支 → 开发 → 提交 PR
- **补充角色**：按下方规范新增内置角色卡
- **完善文档**：修订 README、Wiki 或补充 FAQ

## 环境准备

需要 Node.js 18+ 与 npm。

```bash
# 克隆仓库
git clone https://github.com/19923421354/xingyu.git
cd xingyu

# 安装前端依赖并启动开发服务器
cd web
npm install --ignore-scripts
npm run dev
```

> `--ignore-scripts` 可跳过 onnxruntime-node 原生二进制下载（浏览器 / WebView 运行不需要它）。若你的网络可正常访问 GitHub Releases，也可直接 `npm install`。

## 开发流程

1. Fork 本仓库，clone 到本地
2. 从 `master` 切出功能分支，命名参考：`260814-feat-xxx`（日期-类型-描述）
3. 开发并自测（运行 `npm run build` 确认构建通过）
4. Push 到你的 fork，提交 Pull Request 到 `master`

## 代码规范

- **Vue 3**：使用 `<script setup>` 组合式 API 编写组件
- **样式**：优先使用 `global.css` 中的 CSS 变量（`--card`、`--accent-a` 等），支持深色 / 浅色主题
- **图标**：一律使用 `components/Icon.vue` 中的图标，不要手写 SVG；新增图标在 `Icon.vue` 的 `PATHS` 中注册
- **文案**：界面文案使用简体中文，代码注释可用英文
- **不引入不必要的依赖**：项目刻意保持轻量，能用原生实现就不加库

## 提交 PR

- 标题简洁，说明改动内容，如 `feat(chat): 支持会话内搜索`
- 描述中列出主要改动点
- 若涉及 UI 改动，尽量附上截图
- 一个 PR 只做一件事，避免混杂不相关改动

## 新增角色预设

内置角色卡定义在 `web/src/data/presets.js` 的 `presetCharacters()` 数组中。新增时遵循以下格式：

```js
base({
  id: 'preset-xxx',                       // 唯一 id，前缀 preset-
  name: '角色名',
  tagline: '一句话介绍',
  style: 'gentle',                        // 见 engine/offline.js 的 STYLES
  styleDesc: '语气与说话方式描述',
  avatar: { type: 'gradient', from: '#a1c4fd', to: '#c2e9fb', initial: '字' },
  persona: '角色设定，写具体更生动',
  world: '世界背景',
  greeting: '开场白',
  exampleDialogs: ['用户：…\n角色名：…', '...'],
})
```

要求：人设健康向上、不涉及敏感内容；风格与现有角色有区分度；`style` 必须是 `STYLES` 中已有的 id，否则可先扩展 `STYLES`。

## 报告问题

提交 Issue 时请包含：

- 运行环境（Android 版本 / 浏览器 / 系统）
- 使用场景（内置 AI / 轻量 / Ollama / OpenAI）
- 复现步骤
- 期望行为与实际行为
- 日志或截图（如有）
