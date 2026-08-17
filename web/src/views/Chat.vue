<script setup>
import { ref, computed, nextTick, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { db, charConversations, getActiveConversation, getActiveMessages, addMessage, newConversation, setActiveConversation, deleteConversation, clearConversation, renameConversation, updateMessage, uid, getProfile, removeSummary, clearSummaries, toggleConversationFav, toggleConversationPin, toggleMessageBookmark, bookmarkedMessages, searchInConversation, recordActivity } from '../store'
import Avatar from '../components/Avatar.vue'
import Sheet from '../components/Sheet.vue'
import MarkdownText from '../components/MarkdownText.vue'
import Icon from '../components/Icon.vue'
import { chatReply, summarizeConversation } from '../engine/chat'
import { modelState as localModelState } from '../engine/local'
import { extractProfile } from '../engine/offline'
import { speak, stopSpeak, ttsEnabled, ttsSupported } from '../engine/tts'

const route = useRoute()
const router = useRouter()

const char = computed(() => db.characters.find((c) => c.id === route.params.id))
const convs = computed(() => charConversations(char.value.id))
const sortedConvs = computed(() => {
  const arr = [...convs.value.list]
  return arr.sort((a, b) => Number(b.pinned) - Number(a.pinned) || Number(b.fav) - Number(a.fav) || b.updatedAt - a.updatedAt)
})
const messages = computed(() => getActiveMessages(char.value))
const profile = computed(() => getProfile(char.value.id))

const input = ref('')
const generating = ref(false)
const streamTick = ref(0)
const sheetOpen = ref(false)
const renameOpen = ref(false)
const renameId = ref(null)
const renameText = ref('')
const confirmOpen = ref(false)
const confirmAction = ref(null)
const listRef = ref(null)
const taRef = ref(null)
const summarizing = ref(false)
const memOpen = ref(false)
const toastMsg = ref('')
const editId = ref(null)
const editText = ref('')
const listening = ref(false)
const searchOpen = ref(false)
const searchKw = ref('')
const bookmarksOpen = ref(false)
const emojiOpen = ref(false)
const EMOJIS = ['😊', '😂', '🥰', '😭', '😮', '😤', '😴', '🥺', '🤔', '😳', '😎', '🤗', '💖', '✨', '🔥', '🌙', '☀️', '🌸', '🐱', '🐶', '🎮', '🍜', '☕', '🎵']
let toastTimer = null
let recognition = null

let controller = null
let currentMsgId = null

watch(
  () => route.params.id,
  () => {
    if (char.value) ensureExist()
    nextTick(locateFromQuery)
    input.value = db.drafts && db.drafts[char.value.id] ? db.drafts[char.value.id] : ''
  }
)

watch(() => route.query, () => locateFromQuery())

onMounted(() => {
  nextTick(locateFromQuery)
  if (char.value) input.value = db.drafts && db.drafts[char.value.id] ? db.drafts[char.value.id] : ''
})

watch(input, (v) => {
  if (char.value) {
    if (!db.drafts) db.drafts = {}
    db.drafts[char.value.id] = v
  }
})

function locateFromQuery() {
  const q = route.query
  if (char.value && q.conv && convs.value) {
    const conv = convs.value.list.find((c) => c.id === q.conv)
    if (conv) setActiveConversation(char.value.id, conv.id)
  }
  const hl = q.hl
  if (hl) {
    nextTick(() => {
      const el = listRef.value
      if (!el) return
      const target = el.querySelector(`[data-msg-id="${hl}"]`)
      if (target) {
        target.scrollIntoView({ block: 'center' })
        target.classList.add('hl')
        setTimeout(() => target.classList.remove('hl'), 1800)
      }
    })
  }
}

function ensureExist() {
  getActiveConversation(char.value)
}

function scrollToBottom(force = false) {
  nextTick(() => {
    const el = listRef.value
    if (!el) return
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 140
    if (force || nearBottom) el.scrollTop = el.scrollHeight
  })
}

watch(
  () => messages.value.length,
  () => scrollToBottom(true)
)
watch(streamTick, () => scrollToBottom())

function isPreset() {
  return char.value.id.startsWith('preset-')
}

function openNewConversation() {
  newConversation(char.value)
  editId.value = null
  editText.value = ''
  sheetOpen.value = false
  scrollToBottom(true)
}

const REACTIONS = ['❤️', '😂', '👍', '😢', '✨', '😮']

function toggleReaction(m, emoji) {
  if (!m.reactions) m.reactions = {}
  const cur = m.reactions[emoji] || 0
  if (cur > 0) delete m.reactions[emoji]
  else m.reactions[emoji] = 1
}

function replayGreeting() {
  const conv = getActiveConversation(char.value)
  const g = char.value.greeting || '你好呀'
  conv.messages.push({ id: uid(), role: 'assistant', content: g, ts: Date.now() })
  scrollToBottom(true)
}

function switchConversation(id) {
  setActiveConversation(char.value.id, id)
  editId.value = null
  editText.value = ''
  sheetOpen.value = false
  scrollToBottom(true)
}

function openRename(conv) {
  renameId.value = conv.id
  renameText.value = conv.title
  renameOpen.value = true
}

function doRename() {
  if (renameText.value.trim()) renameConversation(char.value.id, renameId.value, renameText.value.trim())
  renameOpen.value = false
}

function askConfirm(msg, action) {
  confirmAction.value = { msg, action }
  confirmOpen.value = true
}

function doConfirm() {
  if (confirmAction.value) confirmAction.value.action()
  confirmOpen.value = false
  confirmAction.value = null
}

function removeConversation(convId) {
  deleteConversation(char.value.id, convId)
  scrollToBottom(true)
}

function removeMessage(idx) {
  const conv = getActiveConversation(char.value)
  conv.messages.splice(idx, 1)
  scrollToBottom(true)
}

function startEdit(idx) {
  const m = messages.value[idx]
  if (!m || m.role !== 'user') return
  editId.value = m.id
  editText.value = m.content
}

function saveEdit() {
  const conv = getActiveConversation(char.value)
  const i = conv.messages.findIndex((m) => m.id === editId.value)
  if (i >= 0) {
    conv.messages[i].content = editText.value
    // 截断被编辑消息之后的回复，并自动重新生成
    conv.messages.splice(i + 1)
    conv.updatedAt = Date.now()
  }
  editId.value = null
  editText.value = ''
  scrollToBottom(true)
  nextTick(() => generate())
}

function copyText(text) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).catch(() => {})
  }
}

function snippetConv(text) {
  const k = searchKw.value.trim().toLowerCase()
  const t = text || ''
  const idx = t.toLowerCase().indexOf(k)
  if (idx < 0) return t.slice(0, 50)
  const start = Math.max(0, idx - 8)
  return (start > 0 ? '…' : '') + t.slice(start, idx + k.length + 20) + (start + k.length + 20 < t.length ? '…' : '')
}

function exportConversation() {
  const conv = getActiveConversation(char.value)
  const name = char.value.name
  const lines = [`# 星语 AI · ${name} 的对话`, `时间：${new Date().toLocaleString()}`, '']
  for (const m of conv.messages) {
    const who = m.role === 'user' ? (db.settings.userName || '我') : name
    if (m.content) lines.push(`**${who}**：${m.content}`, '')
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${name}-对话记录-${new Date().toISOString().slice(0, 10)}.md`
  a.click()
  URL.revokeObjectURL(url)
}

function copyConversation() {
  const conv = getActiveConversation(char.value)
  const name = char.value.name
  const lines = [`星语 AI · ${name} 的对话`, `时间：${new Date().toLocaleString()}`, '']
  for (const m of conv.messages) {
    const who = m.role === 'user' ? (db.settings.userName || '我') : name
    if (m.content) lines.push(`${who}：${m.content}`, '')
  }
  copyText(lines.join('\n'))
  showToast('已复制对话内容')
}

function showToast(msg) {
  toastMsg.value = msg
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toastMsg.value = ''), 4000)
}

async function doSummarize() {
  if (summarizing.value || !char.value) return
  const hasUser = messages.value.some((m) => m.role === 'user')
  if (!hasUser) {
    showToast('还没有可以总结的对话内容')
    return
  }
  summarizing.value = true
  try {
    const s = await summarizeConversation(char.value, messages.value, profile.value, db.settings, {
      manual: true,
    })
    if (s) showToast('已生成记忆 ✓')
    else showToast('暂无可总结的内容')
  } catch (e) {
    showToast('总结失败：' + ((e && e.message) || '请稍后重试'))
  } finally {
    summarizing.value = false
  }
}

function delMemory(idx) {
  removeSummary(char.value.id, idx)
}

function clearMemories() {
  clearSummaries(char.value.id)
  showToast('已清空记忆')
}

function playTts(msg) {
  if (ttsEnabled()) speak(msg.content)
}

function makeUserMessage(text) {
  return { id: uid(), role: 'user', content: text, ts: Date.now() }
}

async function generate() {
  if (generating.value || !char.value) return
  generating.value = true
  const c = char.value
  const settings = db.settings
  const msgId = uid()
  currentMsgId = msgId
  addMessage(c.id, { id: msgId, role: 'assistant', content: '', ts: Date.now(), thinking: true })
  const all = getActiveMessages(c)
  // 历史消息 = 除去刚追加的空占位消息
  const history = all[all.length - 1] && all[all.length - 1].id === msgId ? all.slice(0, -1) : all
  const modelLoading = settings.provider === 'local'

  if (modelLoading) {
    updateMessage(c.id, getActiveConversation(c).id, msgId, {
      content: '正在唤醒内置 AI 模型…',
      thinking: false,
    })
  }

  controller = new AbortController()

  try {
    const full = await chatReply(
      { character: c, history, profile: profile.value, settings },
      {
        signal: controller.signal,
        onDelta: (d) => {
          streamTick.value++
          const conv = getActiveConversation(c)
          const prev = conv.messages.find((m) => m.id === msgId)?.content || ''
          const base = prev === '正在唤醒内置 AI 模型…' ? '' : prev
          updateMessage(c.id, conv.id, msgId, { content: base + d, thinking: false })
        },
      }
    )
    updateMessage(c.id, getActiveConversation(c).id, msgId, {
      content: full,
      thinking: false,
      error: false,
    })
    if (ttsEnabled() && full) speak(full)
  } catch (e) {
    const isAbort = e && (e.aborted || e.name === 'AbortError')
    const conv = getActiveConversation(c)
    const prev = conv.messages.find((m) => m.id === msgId)?.content || ''
    updateMessage(c.id, conv.id, msgId, {
      content: isAbort ? (prev === '正在唤醒内置 AI 模型…' ? '' : prev) : (e && e.message) || '出错了，请重试',
      thinking: false,
      error: !isAbort,
    })
    if (isAbort) {
      const i = conv.messages.findIndex((m) => m.id === msgId)
      if (i >= 0 && !conv.messages[i].content) conv.messages.splice(i, 1)
    }
  } finally {
    generating.value = false
    currentMsgId = null
    if (controller) controller = null
  }
}

function send(text) {
  const t = (text === undefined ? input.value : text).trim()
  if (!t || generating.value || !char.value) return
  if (text === undefined) input.value = ''
  const msg = makeUserMessage(t)
  addMessage(char.value.id, msg)
  recordActivity(1, t.length)
  extractProfile(t, profile.value)
  generate()
  scrollToBottom(true)
}

const onKeydown = (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    send()
    return
  }
  if (e.key === 'Escape') {
    if (renameOpen.value || confirmOpen.value || memOpen.value || sheetOpen.value || searchOpen.value || bookmarksOpen.value) {
      ;[renameOpen, confirmOpen, memOpen, sheetOpen, searchOpen, bookmarksOpen].forEach((r) => (r.value = false))
    }
  }
}

function stop() {
  if (controller) {
    controller.abort()
    controller = null
  }
  generating.value = false
}

function regenerate() {
  const list = messages.value
  let lastUserIdx = -1
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].role === 'user') {
      lastUserIdx = i
      break
    }
  }
  if (lastUserIdx < 0) return
  while (list.length > lastUserIdx + 1) list.pop()
  generate()
}

function formatTime(ts) {
  const d = new Date(ts)
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

const isLocalLoading = computed(() => db.settings.provider === 'local' && localModelState.status === 'loading')
const progressPct = computed(() => {
  const { loaded, total } = localModelState.progress
  if (!total) return null
  return Math.min(100, Math.round((loaded / total) * 100))
})

// 语音输入
function speechSupported() {
  return typeof window !== 'undefined' && !!((window.SpeechRecognition || window.webkitSpeechRecognition))
}

function toggleVoice() {
  if (!speechSupported()) {
    showToast('当前浏览器不支持语音输入')
    return
  }
  if (listening.value) {
    stopVoice()
    return
  }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition
  recognition = new SR()
  recognition.lang = db.settings.lang === 'en' ? 'en-US' : 'zh-CN'
  recognition.interimResults = true
  recognition.continuous = false
  listening.value = true
  input.value = ''
  recognition.onresult = (e) => {
    let finalText = ''
    for (let i = 0; i < e.results.length; i++) {
      if (e.results[i].isFinal) finalText += e.results[i][0].transcript
    }
    input.value = finalText || input.value
  }
  recognition.onend = () => {
    listening.value = false
    recognition = null
  }
  recognition.onerror = () => {
    listening.value = false
    recognition = null
    showToast('没能听清，请再试一次')
  }
  recognition.start()
}

function stopVoice() {
  if (recognition) {
    try {
      recognition.stop()
    } catch (e) {}
  }
  listening.value = false
}

function insertEmoji(e) {
  input.value += e
  emojiOpen.value = false
  autoGrow({ target: taRef.value })
  taRef.value && taRef.value.focus()
}

// 快捷回复建议
const SUGGEST = {
  cute: ['给我讲个开心的小故事嘛', '我最近有点累，想被安慰', '如果我养了一只猫，你会吃醋吗'],
  gentle: ['我今天有点低落，陪我说说话', '你最近有什么开心的事吗', '给正在努力的我一句鼓励吧'],
  cool: ['别装了，你是不是在关心我', '陪我聊聊天，就今晚', '如果是你，会怎么解决这个麻烦'],
  energetic: ['来点好玩的！今天去哪冒险', '讲讲你最近遇到的好事', '打气！我今天有点没动力'],
  mystery: ['帮我看看今天的运势', '我们的相遇是注定的吗', '你从星象里看到了什么'],
  tsundere: ['哼，你是不是口是心非', '我就想黏着你，不行吗', '其实你也挺关心我的对吧'],
  funny: ['来个冷笑话，越冷越好', '假设你开一家店，会卖什么', '我emo了，快用段子治好我'],
}

const suggestions = computed(() => {
  if (generating.value) return []
  const style = char.value.style || 'gentle'
  const pool = SUGGEST[style] || SUGGEST.gentle
  const hasUser = messages.value.some((m) => m.role === 'user')
  if (!hasUser) return []
  const last = [...messages.value].reverse().find((m) => m.role === 'assistant')
  return last ? pool : []
})

const quickPhrases = computed(() => (db.settings.quickPhrases || []).filter((p) => p && p.trim()))

const convSearchResults = computed(() => {
  const conv = getActiveConversation(char.value)
  return searchInConversation(char.value.id, conv.id, searchKw.value)
})

const bookmarks = computed(() => bookmarkedMessages(char.value.id))

function goConvResult(r) {
  searchOpen.value = false
  searchKw.value = ''
  nextTick(() => {
    const el = listRef.value
    if (!el) return
    const target = el.querySelector(`[data-msg-id="${r.msg.id}"]`)
    if (target) {
      target.scrollIntoView({ block: 'center' })
      target.classList.add('hl')
      setTimeout(() => target.classList.remove('hl'), 1800)
    }
  })
}

function goBookmark(b) {
  bookmarksOpen.value = false
  setActiveConversation(char.value.id, b.conv.id)
  nextTick(() => {
    const el = listRef.value
    if (!el) return
    const target = el.querySelector(`[data-msg-id="${b.msg.id}"]`)
    if (target) {
      target.scrollIntoView({ block: 'center' })
      target.classList.add('hl')
      setTimeout(() => target.classList.remove('hl'), 1800)
    }
  })
}

onBeforeUnmount(() => {
  stopSpeak()
  if (controller) controller.abort()
  if (listening.value && recognition) {
    try {
      recognition.abort()
    } catch (e) {}
  }
})
</script>

<template>
  <div class="chat-page" v-if="char">
    <header class="chat-top">
      <button class="icon-btn" @click="router.push('/')" aria-label="返回">
        <Icon name="back" :size="20" />
      </button>
      <div class="who" @click="sheetOpen = true">
        <Avatar :avatar="char.avatar" :name="char.name" :size="36" />
        <div>
          <div class="who-name">{{ char.name }}</div>
          <div class="who-status"><i class="dot"></i>在线</div>
        </div>
      </div>
      <div class="actions">
        <button class="icon-btn" @click="searchOpen = true" aria-label="会话内搜索">
          <Icon name="search" :size="20" />
        </button>
        <button class="icon-btn" :class="{ 'has-bm': bookmarks.length }" @click="bookmarksOpen = true" aria-label="书签">
          <Icon name="bookmark" :size="20" :filled="bookmarks.length > 0" />
        </button>
        <button class="icon-btn" @click="memOpen = true" aria-label="记忆">
          <Icon name="memory" :size="20" />
        </button>
        <button class="icon-btn" @click="openNewConversation" aria-label="新对话">
          <Icon name="plus" :size="20" />
        </button>
        <button class="icon-btn" @click="sheetOpen = true" aria-label="对话列表">
          <Icon name="message" :size="20" />
        </button>
        <button class="icon-btn" @click="exportConversation" aria-label="导出对话">
          <Icon name="download" :size="20" />
        </button>
        <button class="icon-btn" @click="router.push(`/character/${char.id}/edit`)" aria-label="编辑角色">
          <Icon name="edit" :size="20" />
        </button>
      </div>
    </header>

    <div class="chat-scroll" ref="listRef">
    <div class="msg-list">
      <div v-if="isLocalLoading" class="model-loading">
        <div class="bar"><div class="fill" :class="{ unknown: progressPct === null }" :style="progressPct !== null ? { width: progressPct + '%' } : {}"></div></div>
        <span class="lbl">{{ localModelState.progress.text || '正在唤醒内置 AI 模型…' }}</span>
        <span v-if="localModelState.device" class="lbl dev">加速：{{ localModelState.device === 'webgpu' ? 'WebGPU' : 'CPU' }}</span>
      </div>
      <div class="day-sep" v-if="messages.length">
        <span>{{ char.greeting ? '来自 ' + char.name + ' 的问候' : '对话开始' }}</span>
      </div>
      <div v-for="(m, idx) in messages" :key="m.id" :data-msg-id="m.id" :class="['msg', m.role === 'user' ? 'me' : 'bot']">
        <Avatar v-if="m.role === 'assistant'" :avatar="char.avatar" :name="char.name" :size="34" />
        <div class="bubble-wrap">
          <div v-if="editId === m.id" class="bubble edit-bubble">
            <textarea v-model="editText" rows="3" @keydown.enter.exact.prevent="saveEdit"></textarea>
            <div class="edit-actions">
              <button class="mini" @click="editId = null; editText = ''">取消</button>
              <button class="mini primary" @click="saveEdit">保存并重新回复</button>
            </div>
          </div>
          <template v-else>
            <div :class="['bubble', { error: m.error }]">
              <span v-if="m.thinking && !m.content" class="thinking"><i></i><i></i><i></i></span>
              <MarkdownText v-else-if="m.role === 'assistant' && m.content" :text="m.content" />
              <template v-else>{{ m.content }}</template>
            </div>
            <div v-if="!m.thinking && m.content" class="msg-actions">
              <span class="time">{{ formatTime(m.ts) }}</span>
              <button v-if="m.role === 'assistant' && ttsSupported()" class="mini" @click="playTts(m)">朗读</button>
              <button class="mini" @click="copyText(m.content)">复制</button>
              <button :class="['mini', { bm: m.bookmarked }]" @click="toggleMessageBookmark(char.id, getActiveConversation(char).id, m.id)">书签</button>
              <button v-if="m.role === 'assistant'" class="mini" @click="regenerate">重试</button>
              <button v-if="m.role === 'user'" class="mini" @click="startEdit(idx)">编辑</button>
              <button class="mini danger" @click="removeMessage(idx)">删除</button>
            </div>
            <div v-if="!m.thinking && m.content" class="react-row">
              <button v-for="r in REACTIONS" :key="r" :class="['react', { on: m.reactions && m.reactions[r] }]" @click="toggleReaction(m, r)">{{ r }}</button>
            </div>
          </template>
        </div>
      </div>
      <div v-if="messages.length === 0" class="empty-tip">发送一句话，开启你们的对话吧</div>
      <div class="chat-extra">
        <button class="summarize-btn" :disabled="summarizing || messages.length < 2" @click="doSummarize">
          <Icon name="sparkles" :size="16" />
          {{ summarizing ? '正在总结…' : '智能总结这段对话' }}
        </button>
        <button class="summarize-btn ghost" @click="replayGreeting">
          <Icon name="refresh" :size="16" />
          重播开场白
        </button>
      </div>
    </div>
    </div>

    <div v-if="quickPhrases.length" class="suggest-row">
      <span class="suggest-lbl">快捷短语</span>
      <button v-for="(p, i) in quickPhrases" :key="i" class="suggest-chip" @click="send(p)">{{ p }}</button>
    </div>

    <div v-if="suggestions.length" class="suggest-row">
      <span class="suggest-lbl">想聊点别的？</span>
      <button v-for="(s, i) in suggestions.slice(0, 3)" :key="i" class="suggest-chip" @click="send(s)">{{ s }}</button>
    </div>

    <div class="input-bar">
      <textarea
        v-model="input"
        :placeholder="listening ? '正在聆听…' : `对 ${char.name} 说点什么…`"
        rows="1"
        @keydown="onKeydown"
        @input="autoGrow"
        ref="taRef"
      ></textarea>
      <button class="mic-btn" :class="{ on: listening }" @click="toggleVoice" aria-label="语音输入">
        <Icon :name="listening ? 'micOff' : 'mic'" :size="20" />
      </button>
      <button v-if="!generating" class="emoji-btn" @click="emojiOpen = !emojiOpen" aria-label="表情">
        <span class="emoji-face">😊</span>
      </button>
      <button v-if="!generating" class="send-btn" :disabled="!input.trim()" @click="send" aria-label="发送">
        <Icon name="send" :size="20" />
      </button>
      <button v-else class="send-btn stop" @click="stop" aria-label="停止">
        <Icon name="stop" :size="18" />
      </button>
    </div>

    <transition name="slide-up">
      <div v-if="emojiOpen" class="emoji-panel">
        <button v-for="e in EMOJIS" :key="e" class="emoji-item" @click="insertEmoji(e)">{{ e }}</button>
      </div>
    </transition>

    <Sheet :show="searchOpen" title="搜索这段对话" @close="searchOpen = false">
      <div class="search-inner">
        <div class="search-input">
          <Icon name="search" :size="18" />
          <input v-model="searchKw" placeholder="搜索当前对话的消息…" autofocus />
        </div>
        <div v-if="convSearchResults.length" class="sr-list">
          <button v-for="(r, i) in convSearchResults" :key="i" class="sr-item" @click="goConvResult(r)">
            <span class="sr-role">{{ r.msg.role === 'user' ? (db.settings.userName || '我') : char.name }}</span>
            <span class="sr-snippet">{{ snippetConv(r.msg.content) }}</span>
          </button>
        </div>
        <div v-else-if="searchKw.trim()" class="empty-tip">没有找到匹配的消息</div>
        <div v-else class="empty-tip">输入关键词，搜索当前对话</div>
      </div>
    </Sheet>

    <Sheet :show="bookmarksOpen" title="书签消息" @close="bookmarksOpen = false">
      <div v-if="bookmarks.length" class="bm-list">
        <button v-for="b in bookmarks" :key="b.msg.id" class="bm-item" @click="goBookmark(b)">
          <div class="bm-head">
            <Icon name="bookmark" :size="12" class="bm-ico" />
            <span class="bm-title">{{ b.conv.title }}</span>
          </div>
          <div class="bm-text">{{ b.msg.content.slice(0, 80) }}</div>
        </button>
      </div>
      <div v-else class="empty-tip">还没有书签消息。在消息下方点「书签」即可收藏。</div>
    </Sheet>

    <Sheet :show="sheetOpen" title="对话记录" @close="sheetOpen = false">
      <div class="conv-list">
        <button class="conv-item new" @click="openNewConversation">
          <Icon name="plus" :size="18" /> 开启新对话
        </button>
        <template v-for="conv in sortedConvs" :key="conv.id">
          <div v-if="conv.pinned" class="conv-item" :class="['pinned', { active: conv.id === convs.activeId }]" @click="switchConversation(conv.id)">
            <div class="conv-main">
              <div class="conv-title">
                <Icon name="pin" :size="13" class="pin-ico" />
                {{ conv.title }}
              </div>
              <div class="conv-meta">{{ conv.messages.length }} 条消息 · 已置顶</div>
            </div>
            <button :class="['icon-btn', 'tiny', { star: conv.fav }]" @click.stop="toggleConversationFav(char.id, conv.id)" aria-label="收藏">
              <Icon name="star" :size="16" :filled="conv.fav" />
            </button>
            <button class="icon-btn tiny" @click.stop="toggleConversationPin(char.id, conv.id)" aria-label="取消置顶">
              <Icon name="pin" :size="16" />
            </button>
            <button class="icon-btn tiny" @click.stop="openRename(conv)" aria-label="重命名">
              <Icon name="edit" :size="16" />
            </button>
            <button class="icon-btn tiny" @click.stop="askConfirm('清空这段对话的消息？', () => clearConversation(char.id, conv.id))" aria-label="清空">
              <Icon name="sparkles" :size="16" />
            </button>
            <button class="icon-btn tiny danger" @click.stop="askConfirm('删除这段对话？', () => removeConversation(conv.id))" aria-label="删除">
              <Icon name="trash" :size="16" />
            </button>
          </div>
        </template>
        <div v-for="conv in sortedConvs" :key="conv.id" :class="['conv-item', { active: conv.id === convs.activeId }]" @click="switchConversation(conv.id)">
          <div class="conv-main">
            <div class="conv-title">{{ conv.title }}</div>
            <div class="conv-meta">{{ conv.messages.length }} 条消息</div>
          </div>
          <button class="icon-btn tiny" @click.stop="toggleConversationPin(char.id, conv.id)" aria-label="置顶">
            <Icon name="pin" :size="16" />
          </button>
          <button :class="['icon-btn', 'tiny', { star: conv.fav }]" @click.stop="toggleConversationFav(char.id, conv.id)" aria-label="收藏">
            <Icon name="star" :size="16" :filled="conv.fav" />
          </button>
          <button class="icon-btn tiny" @click.stop="openRename(conv)" aria-label="重命名">
            <Icon name="edit" :size="16" />
          </button>
          <button class="icon-btn tiny" @click.stop="askConfirm('清空这段对话的消息？', () => clearConversation(char.id, conv.id))" aria-label="清空">
            <Icon name="sparkles" :size="16" />
          </button>
          <button class="icon-btn tiny danger" @click.stop="askConfirm('删除这段对话？', () => removeConversation(conv.id))" aria-label="删除">
            <Icon name="trash" :size="16" />
          </button>
        </div>
      </div>
    </Sheet>

    <Sheet :show="renameOpen" title="重命名对话" @close="renameOpen = false">
      <input v-model="renameText" placeholder="输入新的对话标题" />
      <div class="sheet-actions">
        <button class="btn btn-ghost" @click="renameOpen = false">取消</button>
        <button class="btn btn-primary" @click="doRename">保存</button>
      </div>
    </Sheet>

    <Sheet :show="confirmOpen" @close="confirmOpen = false">
      <div class="confirm-text">{{ confirmAction ? confirmAction.msg : '' }}</div>
      <div class="sheet-actions">
        <button class="btn btn-ghost" @click="confirmOpen = false">取消</button>
        <button class="btn btn-danger" @click="doConfirm">确认</button>
      </div>
    </Sheet>

    <Sheet :show="memOpen" title="与 {{ char.name }} 的长期记忆" @close="memOpen = false">
      <div class="mem-tip">每隔 8 轮对话会自动总结，或点击「智能总结」手动沉淀。记忆会让 {{ char.name }} 更懂你。</div>
      <div v-if="!profile.summaries || profile.summaries.length === 0" class="empty-tip">还没有记忆，多聊聊吧</div>
      <div v-for="(s, idx) in profile.summaries" :key="idx" class="mem-item">
        <span>{{ s }}</span>
        <button class="icon-btn tiny danger" @click="delMemory(idx)" aria-label="删除">
          <Icon name="close" :size="15" />
        </button>
      </div>
      <button v-if="profile.summaries && profile.summaries.length" class="btn btn-ghost" style="margin-top: 12px" @click="clearMemories">清空全部记忆</button>
    </Sheet>

    <transition name="fade">
      <div v-if="toastMsg" class="toast">{{ toastMsg }}</div>
    </transition>
  </div>
</template>

<script>
export default {
  methods: {
    autoGrow(e) {
      const t = e.target
      t.style.height = 'auto'
      t.style.height = Math.min(t.scrollHeight, 140) + 'px'
    },
  },
}
</script>

<style scoped>
.chat-page {
  height: 100dvh;
  display: flex;
  flex-direction: column;
  max-width: 640px;
  margin: 0 auto;
}
@media (min-width: 760px) {
  .chat-page {
    max-width: 760px;
    border-left: 1px solid var(--line);
    border-right: 1px solid var(--line);
  }
}
.chat-top {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--line);
  background: var(--bg);
  z-index: 10;
}
.who {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  cursor: pointer;
}
.who-name {
  font-weight: 700;
  font-size: 16px;
}
.who-status {
  font-size: 11px;
  color: var(--ok);
  display: flex;
  align-items: center;
  gap: 4px;
}
.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--ok);
  display: inline-block;
  animation: pulse 2s infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
.actions {
  display: flex;
  gap: 2px;
}
.msg-list {
  overflow-y: auto;
  padding: 14px 14px 8px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.chat-scroll {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.chat-scroll .msg-list {
  flex: 1;
  overflow: visible;
}
.chat-extra {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
  padding-bottom: 8px;
}
.model-loading {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--card);
  border: 1px solid var(--line);
}
.model-loading .bar {
  height: 6px;
  border-radius: 999px;
  background: var(--card-2);
  overflow: hidden;
}
.model-loading .fill {
  height: 100%;
  border-radius: 999px;
  background: var(--grad);
  transition: width 0.3s;
}
.model-loading .fill.unknown {
  width: 35%;
  animation: slide 1.4s ease-in-out infinite;
}
@keyframes slide {
  0% { margin-left: -35%; }
  100% { margin-left: 100%; }
}
.model-loading .lbl {
  font-size: 12px;
  color: var(--text-dim);
}
.model-loading .lbl.dev {
  color: var(--accent-a);
}
.day-sep {
  text-align: center;
  font-size: 12px;
  color: var(--text-faint);
  margin: -4px 0 4px;
}
.msg {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  animation: msg-in 0.22s ease both;
}
@keyframes msg-in {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: none; }
}
.msg.me {
  justify-content: flex-end;
}
.bubble-wrap {
  max-width: 76%;
  display: flex;
  flex-direction: column;
}
.msg.me .bubble-wrap {
  align-items: flex-end;
}
.bubble {
  padding: 10px 14px;
  border-radius: 16px;
  background: var(--card);
  border: 1px solid var(--line);
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 15px;
}
.msg.me .bubble {
  background: var(--user-bubble);
  color: #fff;
  border: none;
  border-bottom-right-radius: 4px;
}
.msg.hl .bubble {
  animation: hl 1.6s ease;
}
@keyframes hl {
  0%, 60% { box-shadow: 0 0 0 3px var(--accent-a); background: rgba(124, 108, 255, 0.14); }
  100% { box-shadow: none; }
}
.msg.bot .bubble {
  border-bottom-left-radius: 4px;
}
.bubble.error {
  color: var(--danger);
  background: rgba(255, 95, 109, 0.1);
  border-color: rgba(255, 95, 109, 0.3);
  font-size: 13px;
}
.edit-bubble {
  background: var(--card-2);
  width: min(320px, 100%);
}
.edit-bubble textarea {
  min-height: 70px;
  background: var(--input-bg);
  font-size: 14px;
}
.edit-actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  margin-top: 8px;
}
.edit-actions .mini.primary {
  color: var(--accent-a);
  font-weight: 700;
}
.thinking {
  display: inline-flex;
  gap: 4px;
  padding: 4px 2px;
}
.thinking i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--text-dim);
  animation: blink 1.2s infinite;
}
.thinking i:nth-child(2) { animation-delay: 0.2s; }
.thinking i:nth-child(3) { animation-delay: 0.4s; }
@keyframes blink {
  0%, 80%, 100% { opacity: 0.25; transform: scale(0.85); }
  40% { opacity: 1; transform: scale(1); }
}
.msg-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
  padding: 0 4px;
  font-size: 12px;
  color: var(--text-faint);
}
.msg.me .msg-actions {
  justify-content: flex-end;
}
.mini {
  font-size: 12px;
  color: var(--text-faint);
  padding: 2px 4px;
  border-radius: 6px;
}
.mini:hover {
  color: var(--text);
  background: var(--glass);
}
.mini.danger:hover {
  color: var(--danger);
}
.react-row {
  display: flex;
  gap: 4px;
  margin-top: 4px;
  padding: 0 4px;
}
.msg.me .react-row {
  justify-content: flex-end;
}
.react {
  font-size: 13px;
  line-height: 1;
  padding: 3px 5px;
  border-radius: 6px;
  opacity: 0.55;
  transition: all 0.15s;
}
.react:hover {
  opacity: 1;
  background: var(--glass);
  transform: scale(1.12);
}
.react.on {
  opacity: 1;
  background: rgba(124, 108, 255, 0.16);
  outline: 1px solid rgba(124, 108, 255, 0.4);
}
.suggest-row {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 8px 12px 2px;
  flex-shrink: 0;
  scrollbar-width: none;
}
.suggest-row::-webkit-scrollbar {
  display: none;
}
.suggest-lbl {
  font-size: 11px;
  color: var(--text-faint);
  align-self: center;
  white-space: nowrap;
}
.suggest-chip {
  font-size: 12px;
  color: var(--text-dim);
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 6px 12px;
  white-space: nowrap;
  transition: all 0.15s;
}
.suggest-chip:active {
  background: rgba(124, 108, 255, 0.14);
  border-color: var(--accent-a);
  color: var(--accent-a);
}
.input-bar {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding: 10px 12px calc(10px + env(safe-area-inset-bottom));
  border-top: 1px solid var(--line);
  background: var(--bg);
}
.input-bar textarea {
  flex: 1;
  max-height: 140px;
  line-height: 1.5;
  padding: 10px 14px;
}
.mic-btn {
  width: 42px;
  height: 42px;
  border-radius: 14px;
  background: var(--card);
  border: 1px solid var(--line);
  color: var(--text-dim);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.15s;
}
.mic-btn.on {
  background: var(--grad);
  color: #fff;
  border-color: transparent;
  animation: mic-pulse 1.4s infinite;
}
.emoji-btn {
  width: 42px;
  height: 42px;
  border-radius: 14px;
  background: var(--card);
  border: 1px solid var(--line);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.15s;
}
.emoji-btn:active {
  transform: scale(0.9);
}
.emoji-face {
  font-size: 18px;
  line-height: 1;
}
.emoji-panel {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 4px;
  padding: 10px 12px;
  background: var(--bg-soft);
  border-top: 1px solid var(--line);
  max-height: 40vh;
  overflow-y: auto;
}
.emoji-item {
  font-size: 22px;
  padding: 6px;
  border-radius: 10px;
  line-height: 1;
  text-align: center;
}
.emoji-item:active {
  background: var(--glass);
  transform: scale(1.15);
}
@keyframes mic-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(255, 95, 162, 0.4); }
  50% { box-shadow: 0 0 0 8px rgba(255, 95, 162, 0); }
}
.send-btn {
  width: 42px;
  height: 42px;
  border-radius: 14px;
  background: var(--grad);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 6px 16px rgba(124, 108, 255, 0.35);
  flex-shrink: 0;
}
.send-btn:disabled {
  opacity: 0.45;
  box-shadow: none;
}
.send-btn.stop {
  background: var(--card-2);
  color: var(--text);
  box-shadow: none;
}
.conv-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.conv-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  border-radius: 14px;
  background: var(--card);
  border: 1px solid var(--line);
  cursor: pointer;
  transition: all 0.15s;
}
.conv-item.active {
  border-color: var(--accent-a);
}
.conv-item.pinned {
  border-style: dashed;
  background: rgba(124, 108, 255, 0.06);
}
.pin-ico {
  color: var(--accent-a);
  vertical-align: -2px;
}
.conv-title .pin-ico {
  margin-right: 2px;
}
.conv-item.new {
  justify-content: center;
  border-style: dashed;
  color: var(--text-dim);
  font-weight: 600;
  gap: 6px;
}
.conv-main {
  flex: 1;
  min-width: 0;
}
.conv-title {
  font-size: 15px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.conv-meta {
  font-size: 12px;
  color: var(--text-faint);
}
.icon-btn.tiny {
  width: 30px;
  height: 30px;
}
.icon-btn.star {
  color: #f5b944;
}
.sheet-actions {
  display: flex;
  gap: 10px;
  margin-top: 14px;
}
.sheet-actions .btn {
  flex: 1;
}
.confirm-text {
  text-align: center;
  font-size: 16px;
  padding: 8px 0 2px;
}
.search-inner {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-bottom: 6px;
}
.search-input {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 14px;
  background: var(--card);
  border: 1px solid var(--line);
  color: var(--text-faint);
}
.search-input input {
  border: none;
  background: transparent;
  padding: 0;
  box-shadow: none;
}
.search-input input:focus {
  box-shadow: none;
}
.sr-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 50vh;
  overflow-y: auto;
}
.sr-item {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 10px 12px;
  border-radius: 12px;
  background: var(--card);
  border: 1px solid var(--line);
  text-align: left;
}
.sr-item:active {
  background: var(--card-2);
}
.sr-role {
  font-size: 12px;
  font-weight: 700;
  color: var(--accent-a);
}
.sr-snippet {
  font-size: 13px;
  color: var(--text);
  line-height: 1.5;
}
.bm-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 60vh;
  overflow-y: auto;
}
.bm-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  border-radius: 12px;
  background: var(--card);
  border: 1px solid var(--line);
  text-align: left;
}
.bm-item:active {
  background: var(--card-2);
}
.bm-head {
  display: flex;
  align-items: center;
  gap: 5px;
}
.bm-ico {
  color: var(--accent-a);
}
.bm-title {
  font-size: 12px;
  color: var(--text-dim);
}
.bm-text {
  font-size: 13px;
  color: var(--text);
  line-height: 1.5;
  word-break: break-all;
}
.mini.bm {
  color: var(--accent-a);
  font-weight: 700;
}
.has-bm {
  color: var(--accent-a);
}
.summarize-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 14px auto 4px;
  padding: 8px 16px;
  font-size: 13px;
  color: var(--accent-a);
  background: rgba(124, 108, 255, 0.08);
  border: 1px solid rgba(124, 108, 255, 0.35);
  border-radius: 999px;
}
.summarize-btn:disabled {
  opacity: 0.6;
}
.mem-tip {
  font-size: 12px;
  color: var(--text-faint);
  line-height: 1.6;
  padding: 4px 2px 10px;
}
.mem-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  font-size: 14px;
  line-height: 1.6;
  padding: 10px 2px;
  border-bottom: 1px solid var(--line);
}
.mem-item .icon-btn {
  flex-shrink: 0;
}
.toast {
  position: fixed;
  left: 50%;
  bottom: 90px;
  transform: translateX(-50%);
  max-width: 84vw;
  padding: 10px 16px;
  font-size: 13px;
  line-height: 1.5;
  color: #fff;
  background: rgba(20, 20, 28, 0.92);
  border-radius: 10px;
  z-index: 200;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
}
</style>
