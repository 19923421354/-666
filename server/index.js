// 星语 AI 本地部署服务器
// 用途：静态托管前端 + 可选的 /api/chat 接口代理，方便局域网共享 / 桌面版启动。
import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = process.env.PORT || 3001

const app = express()
app.use(express.json({ limit: '2mb' }))

// 读取配置：环境变量优先，其次 config.json
function loadConfig() {
  let cfg = {}
  const cfgPath = path.join(__dirname, 'config.json')
  try {
    if (fs.existsSync(cfgPath)) cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'))
  } catch (e) {
    // ignore
  }
  return {
    provider: process.env.XY_PROVIDER || cfg.provider || 'offline',
    baseUrl: process.env.XY_BASE_URL || cfg.baseUrl || '',
    apiKey: process.env.XY_API_KEY || cfg.apiKey || '',
    model: process.env.XY_MODEL || cfg.model || '',
    update: cfg.update || {},
  }
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, app: 'xingyu-chat', time: Date.now() })
})

// 应用内更新信息（前端「检查更新」读取；未配置时实时代理 GitHub Releases 最新版本）
app.get('/api/update.json', async (req, res) => {
  const cfg = loadConfig()
  // 自托管可手动指定版本信息，优先使用
  if (cfg.update && cfg.update.version) {
    return res.json({
      version: cfg.update.version,
      notes: cfg.update.notes || '',
      apkUrl: cfg.update.apkUrl || '',
    })
  }
  // 未配置则实时查询 GitHub Releases，保证「应用内更新」始终拿到最新版本
  try {
    const r = await fetch('https://api.github.com/repos/19923421354/xingyu/releases/latest', {
      headers: { Accept: 'application/vnd.github+json' },
      signal: AbortSignal.timeout(8000),
    })
    if (r.ok) {
      const j = await r.json()
      const asset = (j.assets || []).find((a) => (a.name || '').toLowerCase().endsWith('.apk'))
      return res.json({
        version: (j.tag_name || '').replace(/^v/i, ''),
        notes: j.body || '',
        apkUrl: asset ? asset.browser_download_url : '',
      })
    }
  } catch (e) {
    // GitHub 不可达则返回当前版本
  }
  res.json({ version: '1.2.0', notes: '', apkUrl: '' })
})

// 接口代理：把前端请求转发到 OpenAI 兼容服务（SSE 流式）
app.post('/api/chat', async (req, res) => {
  const cfg = loadConfig()
  const { messages, model, stream = true } = req.body || {}
  if (!Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages 参数无效' })
  }
  if (cfg.provider === 'offline') {
    return res.status(400).json({ error: '服务端未配置接口，请在 config.json 或环境变量中设置' })
  }
  const target = (cfg.baseUrl || '').replace(/\/+$/, '')
  if (!target) return res.status(400).json({ error: '未配置接口地址 XY_BASE_URL' })

  try {
    const upstream = await fetch(target + '/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(cfg.apiKey ? { Authorization: 'Bearer ' + cfg.apiKey } : {}),
      },
      body: JSON.stringify({
        model: model || cfg.model || 'gpt-4o-mini',
        messages,
        stream: !!stream,
        temperature: 0.85,
      }),
    })

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => '')
      return res.status(upstream.status).json({ error: text.slice(0, 300) })
    }

    if (stream) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      })
      const reader = upstream.body.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        res.write(decoder.decode(value, { stream: true }))
      }
      res.end()
    } else {
      const data = await upstream.json()
      res.json(data)
    }
  } catch (e) {
    res.status(500).json({ error: '代理请求失败：' + e.message })
  }
})

// 静态托管前端构建产物
const dist = path.join(__dirname, '..', 'web', 'dist')
if (fs.existsSync(dist)) {
  app.use(express.static(dist))
  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(dist, 'index.html'))
  })
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`星语 AI 服务已启动: http://localhost:${PORT}`)
})
