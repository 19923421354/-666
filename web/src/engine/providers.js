import { analyzeIntent } from './offline'

// 构建发送给 LLM 的上下文消息
export function buildMessages(character, history, settings, profile) {
  const persona = [
    `你是「${character.name}」，一个活在虚构角色扮演世界中的角色。`,
    character.persona ? `角色设定：${character.persona}` : '',
    character.world ? `世界背景：${character.world}` : '',
    `说话风格：${character.styleDesc || '自然、生动、有人情味'}`,
    `请始终以「${character.name}」的身份说话，语言自然口语化，适度推进剧情，不要跳出角色，不要使用"作为AI"之类的表述。`,
    profile && profile.name ? `用户的称呼：${profile.name}` : '',
    profile && profile.likes && profile.likes.length ? `用户喜欢的事物（可自然提起）：${profile.likes.slice(-5).join('、')}` : '',
    profile && profile.summaries && profile.summaries.length
      ? `对话记忆（你记得的关于用户的重要信息，可自然提起）：\n${profile.summaries.slice(-5).join('\n')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n')

  const messages = [{ role: 'system', content: persona }]

  if (character.exampleDialogs && character.exampleDialogs.length) {
    for (const d of character.exampleDialogs.slice(0, 2)) {
      messages.push({ role: 'system', content: '示例对话：\n' + d })
    }
  }

  const recent = history.slice(-24)
  for (const m of recent) {
    if (m.role === 'system') continue
    messages.push({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content })
  }
  return messages
}

export const isNative =
  typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform && Capacitor.isNativePlatform()

// 非流式请求（原生端走 CapacitorHttp，绕过 CORS）
async function nativeChat(baseUrl, apiKey, model, messages, opts) {
  const { CapacitorHttp } = await import('@capacitor/core')
  const headers = { 'Content-Type': 'application/json' }
  if (apiKey) headers.Authorization = 'Bearer ' + apiKey
  const res = await CapacitorHttp.post({
    url: baseUrl.replace(/\/+$/, '') + '/chat/completions',
    headers,
    data: { model, messages, temperature: 0.85, max_tokens: opts.maxTokens || 600 },
    readTimeout: 60000,
    connectTimeout: 10000,
  })
  if (res.status >= 400) {
    throw new Error('接口返回错误 ' + res.status + '：' + JSON.stringify(res.data || {}).slice(0, 300))
  }
  const data = res.data
  const content = data.choices && data.choices[0] && data.choices[0].message
    ? data.choices[0].message.content
    : ''
  if (opts.onDelta) opts.onDelta(content)
  return content
}

// 流式请求（浏览器端）
async function streamChat(baseUrl, apiKey, model, messages, opts) {
  const controller = new AbortController()
  opts.signal && opts.signal.addEventListener('abort', () => controller.abort())

  const headers = { 'Content-Type': 'application/json' }
  if (apiKey) headers.Authorization = 'Bearer ' + apiKey

  let res
  try {
    res = await fetch(baseUrl.replace(/\/+$/, '') + '/chat/completions', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        temperature: 0.85,
        max_tokens: opts.maxTokens || 600,
      }),
      signal: controller.signal,
    })
  } catch (e) {
    if (e.name === 'AbortError') throw { aborted: true }
    throw new Error('无法连接接口，请检查地址与网络。' + e.message)
  }

  if (!res.ok) {
    let detail = ''
    try {
      detail = JSON.stringify(await res.json()).slice(0, 300)
    } catch (e) {
      detail = await res.text().catch(() => '')
    }
    throw new Error('接口返回错误 ' + res.status + '：' + detail)
  }

  if (!res.body) {
    throw new Error('当前环境不支持流式请求，请尝试开启 CORS 或使用网页版。')
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let full = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop()
    for (const line of lines) {
      const t = line.trim()
      if (!t.startsWith('data:')) continue
      const payload = t.slice(5).trim()
      if (payload === '[DONE]') continue
      try {
        const json = JSON.parse(payload)
        const delta =
          (json.choices && json.choices[0] && json.choices[0].delta && json.choices[0].delta.content) ||
          (json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content)
        if (delta) {
          full += delta
          if (opts.onDelta) opts.onDelta(delta)
        }
      } catch (e) {
        // 忽略非 JSON 行
      }
    }
  }
  return full
}

export async function requestChat(baseUrl, apiKey, model, messages, opts = {}) {
  if (isNative) {
    return nativeChat(baseUrl, apiKey, model, messages, opts)
  }
  return streamChat(baseUrl, apiKey, model, messages, opts)
}

// 根据设置选择调用路径
export function resolveProvider(settings) {
  if (settings.provider === 'openai') {
    const s = settings.openai
    if (!s.baseUrl) throw new Error('请先在设置中填写 OpenAI 兼容接口地址')
    return { baseUrl: s.baseUrl, apiKey: s.apiKey, model: s.model || 'gpt-4o-mini' }
  }
  if (settings.provider === 'ollama') {
    const s = settings.ollama
    const baseUrl = s.baseUrl || 'http://localhost:11434/v1'
    return { baseUrl, apiKey: '', model: s.model || 'qwen2.5:7b' }
  }
  throw new Error('未启用 LLM 接口')
}

export { analyzeIntent }
