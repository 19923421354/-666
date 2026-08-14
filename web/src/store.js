import { reactive, watch } from 'vue'

const P = 'xingyu.v1.'

function storageGet(key, fallback) {
  try {
    const raw = localStorage.getItem(P + key)
    if (raw == null) return fallback
    return JSON.parse(raw)
  } catch (e) {
    return fallback
  }
}

function storageSet(key, val) {
  try {
    localStorage.setItem(P + key, JSON.stringify(val))
  } catch (e) {
    // 存储空间不足或不可用时静默降级为内存模式
  }
}

export function uid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10)
}

export const defaultSettings = () => ({
  provider: 'local',
  openai: { baseUrl: '', apiKey: '', model: '' },
  ollama: { baseUrl: 'http://localhost:11434/v1', model: '' },
  local: { temperature: 0.8, maxTokens: 220, contextLimit: 4096 },
  contextWindow: 24,
  theme: 'system',
  userName: '我',
  tts: { enabled: true, rate: 1.0, pitch: 1.0 },
})

export const db = reactive({
  settings: defaultSettings(),
  characters: [],
  conversations: {},
  profiles: {},
  drafts: {},
})

function load() {
  db.settings = { ...defaultSettings(), ...storageGet('settings', {}) }
  db.characters = storageGet('characters', null)
  if (!Array.isArray(db.characters) || db.characters.length === 0) {
    db.characters = []
  }
  db.conversations = storageGet('conversations', {})
  db.profiles = storageGet('profiles', {})
  db.drafts = storageGet('drafts', {})
}

let saveTimer = null
function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    storageSet('settings', db.settings)
    storageSet('characters', db.characters)
    storageSet('conversations', db.conversations)
    storageSet('profiles', db.profiles)
    storageSet('drafts', db.drafts)
  }, 120)
}

watch(
  db,
  () => {
    scheduleSave()
  },
  { deep: true }
)

export function charConversations(charId) {
  if (!db.conversations[charId]) {
    db.conversations[charId] = { list: [], activeId: null }
  }
  return db.conversations[charId]
}

export function ensureConversation(char) {
  const convs = charConversations(char.id)
  if (convs.list.length === 0) {
    const conv = {
      id: uid(),
      title: '新的对话',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      fav: false,
      messages: [
        { id: uid(), role: 'assistant', content: char.greeting || '你好呀', ts: Date.now() },
      ],
    }
    convs.list.push(conv)
    convs.activeId = conv.id
  }
  return convs
}

export function getActiveConversation(char) {
  ensureConversation(char)
  const convs = charConversations(char.id)
  const conv = convs.list.find((c) => c.id === convs.activeId) || convs.list[0]
  return conv
}

export function getActiveMessages(char) {
  return getActiveConversation(char).messages
}

export function addMessage(charId, msg) {
  const convs = charConversations(charId)
  const conv = convs.list.find((c) => c.id === convs.activeId)
  if (!conv) return
  conv.messages.push(msg)
  conv.updatedAt = Date.now()
  if (conv.messages.length === 2) {
    const firstUser = conv.messages.find((m) => m.role === 'user')
    if (firstUser) {
      conv.title = firstUser.content.slice(0, 20)
    }
  }
  if (convs.list.length > 1) {
    convs.list.sort((a, b) => Number(b.fav) - Number(a.fav) || b.updatedAt - a.updatedAt)
  }
}

export function newConversation(char) {
  const convs = charConversations(char.id)
  const conv = {
    id: uid(),
    title: '新的对话',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    fav: false,
    messages: [
      { id: uid(), role: 'assistant', content: char.greeting || '你好呀', ts: Date.now() },
    ],
  }
  convs.list.unshift(conv)
  convs.activeId = conv.id
  return conv
}

export function toggleConversationFav(charId, convId) {
  const convs = charConversations(charId)
  const conv = convs.list.find((c) => c.id === convId)
  if (conv) conv.fav = !conv.fav
}

export function setActiveConversation(charId, convId) {
  const convs = charConversations(charId)
  convs.activeId = convId
}

export function deleteConversation(charId, convId) {
  const convs = charConversations(charId)
  const i = convs.list.findIndex((c) => c.id === convId)
  if (i >= 0) convs.list.splice(i, 1)
  if (convs.activeId === convId) {
    convs.activeId = convs.list.length ? convs.list[0].id : null
  }
}

export function renameConversation(charId, convId, title) {
  const convs = charConversations(charId)
  const conv = convs.list.find((c) => c.id === convId)
  if (conv) conv.title = title
}

export function updateMessage(charId, convId, msgId, patch) {
  const convs = charConversations(charId)
  const conv = convs.list.find((c) => c.id === convId)
  if (!conv) return
  const m = conv.messages.find((x) => x.id === msgId)
  if (m) Object.assign(m, patch)
}

export function upsertCharacter(char) {
  const i = db.characters.findIndex((c) => c.id === char.id)
  if (i >= 0) db.characters[i] = char
  else db.characters.unshift(char)
}

// 解析角色卡 JSON（支持完整导出包或单角色对象）
export function parseCharacterImport(text) {
  const data = JSON.parse(text)
  const c = data && data.type === 'character' ? data.character : data
  if (!c || !c.name) throw new Error('不是有效的角色卡')
  return {
    id: uid(),
    name: c.name,
    tagline: c.tagline || '',
    style: c.style || 'gentle',
    styleDesc: c.styleDesc || '',
    persona: c.persona || '',
    world: c.world || '',
    greeting: c.greeting || '',
    exampleDialogs: Array.isArray(c.exampleDialogs) ? c.exampleDialogs : [],
    avatar: c.avatar || { type: 'gradient', from: '#a1c4fd', to: '#c2e9fb' },
    updatedAt: Date.now(),
  }
}

// 导出单角色卡
export function exportCharacterJson(char) {
  return JSON.stringify({ app: 'xingyu-chat', type: 'character', version: 1, character: char }, null, 2)
}

// 全局搜索消息：返回 [{ char, conv, msg, charId }]
export function searchMessages(keyword) {
  const k = (keyword || '').trim().toLowerCase()
  if (!k) return []
  const out = []
  for (const c of db.characters) {
    const convs = db.conversations[c.id]
    if (!convs || !convs.list) continue
    for (const conv of convs.list) {
      for (const m of conv.messages) {
        if (m.content && m.content.toLowerCase().includes(k)) {
          out.push({ char: c, conv, msg: m, charId: c.id, convId: conv.id })
        }
      }
    }
  }
  return out
}

export function deleteCharacter(charId) {
  db.characters = db.characters.filter((c) => c.id !== charId)
  delete db.conversations[charId]
}

export function toggleCharacterFav(charId) {
  const c = db.characters.find((x) => x.id === charId)
  if (c) c.fav = !c.fav
}

// 最近聊过的会话（跨角色，按更新时间倒序，最多取 n 条）
export function recentConversations(n = 6) {
  const out = []
  for (const c of db.characters) {
    const convs = db.conversations[c.id]
    if (!convs || !convs.list) continue
    for (const conv of convs.list) {
      const userCount = conv.messages ? conv.messages.filter((m) => m.role === 'user').length : 0
      if (userCount === 0) continue
      out.push({ char: c, conv })
    }
  }
  out.sort((a, b) => b.conv.updatedAt - a.conv.updatedAt)
  return out.slice(0, n)
}

export function exportAll() {
  return JSON.stringify(
    {
      app: 'xingyu-chat',
      version: 1,
      exportedAt: Date.now(),
      settings: db.settings,
      characters: db.characters,
      conversations: db.conversations,
    },
    null,
    2
  )
}

export function importAll(text) {
  try {
    const data = JSON.parse(text)
    if (!data || data.app !== 'xingyu-chat' || !Array.isArray(data.characters)) {
      return { ok: false, msg: '文件格式不正确' }
    }
    db.characters = data.characters
    db.conversations = data.conversations || {}
    if (data.settings) db.settings = { ...defaultSettings(), ...data.settings }
    return { ok: true }
  } catch (e) {
    return { ok: false, msg: '解析失败：' + e.message }
  }
}

export function resetAll() {
  db.characters = []
  db.conversations = {}
  db.profiles = {}
  db.drafts = {}
  db.settings = defaultSettings()
}

export function getProfile(charId) {
  if (!db.profiles[charId]) {
    db.profiles[charId] = {}
  }
  const base = { name: '', likes: [], events: [], summaries: [] }
  const p = db.profiles[charId]
  for (const k of Object.keys(base)) {
    if (p[k] === undefined) p[k] = base[k]
  }
  return p
}

export function removeSummary(charId, idx) {
  const p = db.profiles[charId]
  if (p && Array.isArray(p.summaries) && p.summaries[idx] !== undefined) {
    p.summaries.splice(idx, 1)
  }
}

export function clearSummaries(charId) {
  const p = db.profiles[charId]
  if (p) p.summaries = []
}

load()
