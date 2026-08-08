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
  theme: 'dark',
  userName: '我',
  tts: { enabled: true, rate: 1.0, pitch: 1.0 },
})

export const db = reactive({
  settings: defaultSettings(),
  characters: [],
  conversations: {},
  profiles: {},
})

function load() {
  db.settings = { ...defaultSettings(), ...storageGet('settings', {}) }
  db.characters = storageGet('characters', null)
  if (!Array.isArray(db.characters) || db.characters.length === 0) {
    db.characters = []
  }
  db.conversations = storageGet('conversations', {})
  db.profiles = storageGet('profiles', {})
}

let saveTimer = null
function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    storageSet('settings', db.settings)
    storageSet('characters', db.characters)
    storageSet('conversations', db.conversations)
    storageSet('profiles', db.profiles)
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
    convs.list.sort((a, b) => b.updatedAt - a.updatedAt)
  }
}

export function newConversation(char) {
  const convs = charConversations(char.id)
  const conv = {
    id: uid(),
    title: '新的对话',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [
      { id: uid(), role: 'assistant', content: char.greeting || '你好呀', ts: Date.now() },
    ],
  }
  convs.list.unshift(conv)
  convs.activeId = conv.id
  return conv
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

export function deleteCharacter(charId) {
  db.characters = db.characters.filter((c) => c.id !== charId)
  delete db.conversations[charId]
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
  db.settings = defaultSettings()
}

export function getProfile(charId) {
  if (!db.profiles[charId]) {
    db.profiles[charId] = { name: '', likes: [], events: [] }
  }
  return db.profiles[charId]
}

load()
