// 统一聊天调度：根据设置选择 本地模型 / 离线模板引擎 / 外部接口
import { buildMessages, resolveProvider, requestChat } from './providers'
import { generateReply } from './offline'

export async function chatReply({ character, history, profile, settings }, opts = {}) {
  const provider = settings.provider

  if (provider === 'local') {
    const { generate } = await import('./local')
    const messages = buildMessages(character, history, settings, profile)
    return generate(messages, { maxTokens: 220, temperature: 0.8, ...opts })
  }

  if (provider === 'offline') {
    await new Promise((r) => setTimeout(r, 250 + Math.random() * 350))
    const reply = generateReply(character, history, profile)
    if (opts.onDelta) opts.onDelta(reply)
    return reply
  }

  // openai / ollama
  const { baseUrl, apiKey, model } = resolveProvider(settings)
  const messages = buildMessages(character, history, settings, profile)
  return requestChat(baseUrl, apiKey, model, messages, {
    maxTokens: 600,
    ...opts,
  })
}
