// 统一聊天调度：根据设置选择 本地模型 / 离线模板引擎 / 外部接口
import { buildMessages, resolveProvider, requestChat } from './providers'
import { generateReply } from './offline'

export async function chatReply({ character, history, profile, settings }, opts = {}) {
  const provider = settings.provider
  let result

  if (provider === 'local') {
    const { generate } = await import('./local')
    const messages = buildMessages(character, history, settings, profile)
    const p = settings.local || {}
    result = await generate(messages, {
      maxTokens: p.maxTokens || 220,
      temperature: p.temperature ?? 0.8,
      ...opts,
    })
  } else if (provider === 'offline') {
    await new Promise((r) => setTimeout(r, 250 + Math.random() * 350))
    result = generateReply(character, history, profile)
    if (opts.onDelta) opts.onDelta(result)
  } else {
    // openai / ollama
    const { baseUrl, apiKey, model } = resolveProvider(settings)
    const messages = buildMessages(character, history, settings, profile)
    result = await requestChat(baseUrl, apiKey, model, messages, {
      maxTokens: 600,
      ...opts,
    })
  }

  // 异步沉淀长期记忆（不阻塞回复）
  scheduleMemory(character, history, profile, settings)
  return result
}

// 每隔若干轮对话自动总结一次，形成长期记忆
function scheduleMemory(character, history, profile, settings) {
  try {
    if (!profile || settings.provider === 'offline') return
    const userCount = history.filter((m) => m.role === 'user').length
    if (userCount < 8 || userCount % 8 !== 0) return
    summarizeConversation(character, history, profile, settings).catch(() => {})
  } catch (e) {
    // 记忆沉淀失败不影响主流程
  }
}

async function summarizeConversation(character, history, profile, settings) {
  const messages = buildMessages(character, history, settings, profile)
  messages.push({
    role: 'user',
    content:
      '请用一到两句话，总结以上对话中关于「用户」的重要信息（身份、喜好、正在经历的事、与角色的关系等）。只输出总结本身，不要客套话，不要超过两句话。',
  })

  let text = ''
  if (settings.provider === 'local') {
    const { generate } = await import('./local')
    text = await generate(messages, { maxTokens: 60, temperature: 0.4 })
  } else {
    const { baseUrl, apiKey, model } = resolveProvider(settings)
    text = await requestChat(baseUrl, apiKey, model, messages, { maxTokens: 80, temperature: 0.4 })
  }

  const clean = (text || '').trim().replace(/\s+/g, ' ').slice(0, 90)
  if (clean.length < 8) return
  const list = profile.summaries || (profile.summaries = [])
  if (!list.includes(clean)) {
    list.push(clean)
    if (list.length > 15) list.shift()
  }
}
