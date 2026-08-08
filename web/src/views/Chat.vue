<script setup>
import { ref, computed, nextTick, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { db, charConversations, getActiveConversation, getActiveMessages, addMessage, newConversation, setActiveConversation, deleteConversation, renameConversation, updateMessage, uid, getProfile, removeSummary, clearSummaries } from '../store'
import Avatar from '../components/Avatar.vue'
import Sheet from '../components/Sheet.vue'
import MarkdownText from '../components/MarkdownText.vue'
import { chatReply, summarizeConversation } from '../engine/chat'
import { modelState as localModelState } from '../engine/local'
import { extractProfile } from '../engine/offline'
import { speak, stopSpeak, ttsEnabled, ttsSupported } from '../engine/tts'

const route = useRoute()
const router = useRouter()

const char = computed(() => db.characters.find((c) => c.id === route.params.id))
const convs = computed(() => charConversations(char.value.id))
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
const summarizing = ref(false)
const memOpen = ref(false)
const toastMsg = ref('')
let toastTimer = null

let controller = null
let currentMsgId = null

watch(
  () => route.params.id,
  () => {
    if (char.value) ensureExist()
    nextTick(locateFromQuery)
  }
)

watch(() => route.query, () => locateFromQuery())

onMounted(() => {
  nextTick(locateFromQuery)
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
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120
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
  sheetOpen.value = false
  scrollToBottom(true)
}

function switchConversation(id) {
  setActiveConversation(char.value.id, id)
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

function copyText(text) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).catch(() => {})
  }
}

function exportConversation() {
  const conv = getActiveConversation(char.value)
  const name = char.value.name
  const lines = [`星语 AI · ${name} 的对话`, `时间：${new Date().toLocaleString()}`, '']
  for (const m of conv.messages) {
    const who = m.role === 'user' ? (db.settings.userName || '我') : name
    if (m.content) lines.push(`${who}：${m.content}`, '')
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${name}-对话记录-${new Date().toISOString().slice(0, 10)}.txt`
  a.click()
  URL.revokeObjectURL(url)
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
  const history = getActiveMessages(c).slice(0, -1)
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

function send() {
  const text = input.value.trim()
  if (!text || generating.value || !char.value) return
  input.value = ''
  const msg = makeUserMessage(text)
  addMessage(char.value.id, msg)
  extractProfile(text, profile.value)
  generate()
  scrollToBottom(true)
}

function onKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    send()
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

onBeforeUnmount(() => {
  stopSpeak()
  if (controller) controller.abort()
})
</script>

<template>
  <div class="chat-page" v-if="char">
    <header class="chat-top">
      <button class="icon-btn" @click="router.push('/')" aria-label="返回">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"></path></svg>
      </button>
      <div class="who" @click="sheetOpen = true">
        <Avatar :avatar="char.avatar" :name="char.name" :size="36" />
        <div>
          <div class="who-name">{{ char.name }}</div>
          <div class="who-status"><i class="dot"></i>在线</div>
        </div>
      </div>
      <div class="actions">
        <button class="icon-btn" @click="memOpen = true" aria-label="记忆">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6v3H9zM9 3v1a4 4 0 0 0 4 4 4 4 0 0 0 4-4V3M9 12h.01M15 12h.01M9 17h.01M15 17h.01M5 7a2 2 0 0 1 2 2v9a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V9a2 2 0 0 1 2-2"></path></svg>
        </button>
        <button class="icon-btn" @click="openNewConversation" aria-label="新对话">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"></path></svg>
        </button>
        <button class="icon-btn" @click="sheetOpen = true" aria-label="对话列表">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
        </button>
        <button class="icon-btn" @click="exportConversation" aria-label="导出对话">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"></path></svg>
        </button>
        <button class="icon-btn" @click="router.push(`/character/${char.id}/edit`)" aria-label="编辑角色">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
        </button>
      </div>
    </header>

    <div class="msg-list" ref="listRef">
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
          <div :class="['bubble', { error: m.error }]">
            <span v-if="m.thinking && !m.content" class="thinking"><i></i><i></i><i></i></span>
            <MarkdownText v-else-if="m.role === 'assistant' && m.content" :text="m.content" />
            <template v-else>{{ m.content }}</template>
          </div>
          <div v-if="!m.thinking && m.content" class="msg-actions">
            <span class="time">{{ formatTime(m.ts) }}</span>
            <button v-if="m.role === 'assistant' && ttsSupported()" class="mini" @click="playTts(m)">朗读</button>
            <button class="mini" @click="copyText(m.content)">复制</button>
            <button v-if="m.role === 'assistant'" class="mini" @click="regenerate">重试</button>
            <button class="mini danger" @click="removeMessage(idx)">删除</button>
          </div>
        </div>
      </div>
      <div v-if="messages.length === 0" class="empty-tip">发送一句话，开启你们的对话吧</div>
      <button v-if="messages.length >= 2" class="summarize-btn" :disabled="summarizing" @click="doSummarize">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-9 9 9M5 10v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V10M9 21v-6h6v6"></path></svg>
        {{ summarizing ? '正在总结…' : '智能总结这段对话' }}
      </button>
    </div>

    <div class="input-bar">
      <textarea
        v-model="input"
        :placeholder="`对 ${char.name} 说点什么…`"
        rows="1"
        @keydown="onKeydown"
        @input="autoGrow"
        ref="taRef"
      ></textarea>
      <button v-if="!generating" class="send-btn" :disabled="!input.trim()" @click="send" aria-label="发送">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"></path></svg>
      </button>
      <button v-else class="send-btn stop" @click="stop" aria-label="停止">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"></rect></svg>
      </button>
    </div>

    <Sheet :show="sheetOpen" title="对话记录" @close="sheetOpen = false">
      <div class="conv-list">
        <button class="conv-item new" @click="openNewConversation">
          <span class="plus">+</span> 开启新对话
        </button>
        <div v-for="conv in convs.list" :key="conv.id" :class="['conv-item', { active: conv.id === convs.activeId }]" @click="switchConversation(conv.id)">
          <div class="conv-main">
            <div class="conv-title">{{ conv.title }}</div>
            <div class="conv-meta">{{ conv.messages.length }} 条消息</div>
          </div>
          <button class="icon-btn tiny" @click.stop="openRename(conv)" aria-label="重命名">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
          </button>
          <button class="icon-btn tiny danger" @click.stop="askConfirm('删除这段对话？', () => removeConversation(conv.id))" aria-label="删除">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path></svg>
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
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"></path></svg>
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
}
.actions {
  display: flex;
  gap: 2px;
}
.msg-list {
  flex: 1;
  overflow-y: auto;
  padding: 14px 14px 8px;
  display: flex;
  flex-direction: column;
  gap: 14px;
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
.conv-item.new {
  justify-content: center;
  border-style: dashed;
  color: var(--text-dim);
  font-weight: 600;
}
.conv-item.new .plus {
  font-size: 18px;
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
