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
    // maxTokens 为 0 表示无上限
    const maxTokens = p.maxTokens ?? 220
    result = await generate(messages, {
      maxTokens,
      temperature: p.temperature ?? 0.8,
      contextLimit: p.contextLimit,
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

// 总结对话为长期记忆。manual=true 表示用户手动一键总结（输出更完整、返回文本供提示）
export async function summarizeConversation(character, history, profile, settings, opts = {}) {
  const { manual = false } = opts
  const messages = buildMessages(character, history, settings, profile)
  messages.push({
    role: 'user',
    content: manual
      ? '请总结以上对话的主要内容：用户是谁、聊了什么、用户当前的状态与情绪、与角色的关系进展。分要点列出，简洁清晰，不要客套话，不超过 150 字。'
      : '请用一到两句话，总结以上对话中关于「用户」的重要信息（身份、喜好、正在经历的事、与角色的关系等）。只输出总结本身，不要客套话，不要超过两句话。',
  })

  let text = ''
  if (settings.provider === 'local') {
    const { generate } = await import('./local')
    text = await generate(messages, { maxTokens: manual ? 200 : 60, temperature: 0.4, contextLimit: 4096 })
  } else if (settings.provider !== 'offline') {
    const { baseUrl, apiKey, model } = resolveProvider(settings)
    text = await requestChat(baseUrl, apiKey, model, messages, { maxTokens: manual ? 200 : 80, temperature: 0.4 })
  } else {
    // 离线引擎无法做 LLM 总结，抽取最近几条用户消息要点
    const userMsgs = history.filter((m) => m.role === 'user').slice(-5)
    text = userMsgs.length ? '用户提到过：' + userMsgs.map((m) => m.content.slice(0, 40)).join('；') : ''
  }

  const clean = (text || '').trim().replace(/\s+/g, ' ').slice(0, manual ? 160 : 90)
  if (clean.length < 8) return manual ? '' : undefined
  const list = profile.summaries || (profile.summaries = [])
  if (!list.includes(clean)) {
    list.push(clean)
    if (list.length > 15) list.shift()
  }
  return clean
}
