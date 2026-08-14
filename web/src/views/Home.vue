<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { db, searchMessages, parseCharacterImport, upsertCharacter, toggleCharacterFav, recentConversations, characterTags } from '../store'
import CharacterCard from '../components/CharacterCard.vue'
import Avatar from '../components/Avatar.vue'
import Sheet from '../components/Sheet.vue'
import Icon from '../components/Icon.vue'

const router = useRouter()
const keyword = ref('')
const tab = ref('all')
const tagFilter = ref('')

const searchOpen = ref(false)
const searchKw = ref('')
const importFile = ref(null)
const results = computed(() => searchMessages(searchKw.value))

const recents = computed(() => recentConversations(5))

const tags = computed(() => characterTags())

const list = computed(() => {
  let arr = [...db.characters]
  if (tab.value === 'mine') {
    arr = arr.filter((c) => !c.id.startsWith('preset-'))
  }
  if (tab.value === 'fav') {
    arr = arr.filter((c) => c.fav)
  }
  if (tagFilter.value) {
    arr = arr.filter((c) => (c.tags || []).includes(tagFilter.value))
  }
  if (keyword.value.trim()) {
    const k = keyword.value.trim().toLowerCase()
    arr = arr.filter(
      (c) =>
        c.name.toLowerCase().includes(k) ||
        (c.tagline || '').toLowerCase().includes(k) ||
        (c.persona || '').toLowerCase().includes(k)
    )
  }
  return arr
})

function goSearchResult(r) {
  searchOpen.value = false
  searchKw.value = ''
  router.push({ path: `/chat/${r.charId}`, query: { hl: r.msg.id, conv: r.convId } })
}

function openImport() {
  importFile.value && importFile.value.click()
}

function openRandom() {
  const mine = db.characters.filter((c) => c.id.startsWith('preset-'))
  const pool = mine.length ? mine : db.characters
  if (!pool.length) return
  const c = pool[Math.floor(Math.random() * pool.length)]
  router.push({ path: `/chat/${c.id}` })
}

function onImportFile(e) {
  const file = e.target.files && e.target.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    try {
      const c = parseCharacterImport(String(reader.result))
      upsertCharacter(c)
      router.push({ path: `/chat/${c.id}` })
    } catch (err) {
      alert('导入失败：' + ((err && err.message) || err))
    }
  }
  reader.readAsText(file)
}

function snippet(text) {
  const k = searchKw.value.trim().toLowerCase()
  const t = text || ''
  const idx = t.toLowerCase().indexOf(k)
  if (idx < 0) return t.slice(0, 40)
  const start = Math.max(0, idx - 10)
  return (start > 0 ? '…' : '') + t.slice(start, idx + k.length + 24) + (start + k.length + 24 < t.length ? '…' : '')
}

// 全局快捷键：/ 或 Ctrl+K 打开搜索
function onGlobalKey(e) {
  if ((e.key === '/' || (e.key === 'k' && (e.ctrlKey || e.metaKey))) && !e.target.closest('input, textarea, select')) {
    e.preventDefault()
    searchOpen.value = true
  }
}
onMounted(() => {
  window.addEventListener('keydown', onGlobalKey)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onGlobalKey)
})

// 今日运势：按日期种子生成，每天固定
const today = new Date()
const dateKey = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`
const LUCK = [
  { lv: '大吉', emoji: '✨', text: '星光正盛，今天的你走到哪里都在发光', grad: 'linear-gradient(120deg, #7c6cff, #ff5fa2)' },
  { lv: '上上签', emoji: '🌟', text: '适合大胆开口，说出心里的话，会有好事发生', grad: 'linear-gradient(120deg, #ff9a9e, #fecfef)' },
  { lv: '好运', emoji: '🍀', text: '今天会遇到久违的默契，认真回应每一句话', grad: 'linear-gradient(120deg, #a8e063, #56ab2f)' },
  { lv: '小确幸', emoji: '💫', text: '适合许愿与告白，温柔的话多说一点，温暖就多一分', grad: 'linear-gradient(120deg, #84fab0, #8fd3f4)' },
  { lv: '心意相通', emoji: '💌', text: 'TA 也许正等着你主动说一句话，今天就是好时机', grad: 'linear-gradient(120deg, #fbc2eb, #a6c1ee)' },
]
const luck = LUCK[dateKey.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % LUCK.length]

const charCount = computed(() => db.characters.length)
const lastMsgOf = (conv) => {
  if (!conv || !conv.messages) return ''
  const arr = [...conv.messages].reverse().find((m) => m.content)
  return arr ? arr.content.slice(0, 34) : ''
}
</script>

<template>
  <div class="page home">
    <header class="top">
      <div class="brand">
        <div class="logo">星</div>
        <div>
          <h1>星语 AI</h1>
          <p>你的 AI 角色扮演伙伴 · {{ charCount }} 位角色</p>
        </div>
      </div>
      <div class="head-actions">
        <button class="icon-btn" @click="searchOpen = true" aria-label="搜索消息">
          <Icon name="search" :size="20" />
        </button>
        <button class="icon-btn" @click="router.push('/stats')" aria-label="聊天统计">
          <Icon name="flame" :size="20" />
        </button>
        <button class="icon-btn" @click="openImport" aria-label="导入角色">
          <Icon name="upload" :size="20" />
        </button>
        <button class="icon-btn" @click="router.push('/settings')" aria-label="设置">
          <Icon name="settings" :size="20" />
        </button>
      </div>
    </header>

    <div class="search">
      <Icon name="search" :size="18" />
      <input v-model="keyword" placeholder="搜索角色、介绍…" />
    </div>

    <div class="luck-card" :style="{ background: luck.grad }">
      <div class="luck-left">
        <span class="luck-emoji">{{ luck.emoji }}</span>
        <div>
          <div class="luck-lv">今日运势 · {{ luck.lv }}</div>
          <div class="luck-text">{{ luck.text }}</div>
        </div>
      </div>
      <span class="luck-tag">{{ dateKey.split('-').slice(1).join('/') }}</span>
    </div>

    <div v-if="recents.length" class="recent">
      <div class="sec-title">最近聊过</div>
      <div class="recent-list">
        <button v-for="r in recents" :key="r.conv.id" class="recent-item" @click="router.push({ path: `/chat/${r.char.id}`, query: { conv: r.conv.id } })">
          <Avatar :avatar="r.char.avatar" :name="r.char.name" :size="38" />
          <div class="recent-main">
            <div class="recent-name">{{ r.char.name }} <span class="recent-conv">{{ r.conv.title }}</span></div>
            <div class="recent-msg">{{ lastMsgOf(r.conv) }}</div>
          </div>
          <Icon name="chevronRight" :size="16" class="recent-arrow" />
        </button>
      </div>
    </div>

    <div class="tabs">
      <button :class="['chip', { active: tab === 'all' }]" @click="tab = 'all'">全部角色</button>
      <button :class="['chip', { active: tab === 'mine' }]" @click="tab = 'mine'">我的角色</button>
      <button :class="['chip', { active: tab === 'fav' }]" @click="tab = 'fav'">收藏</button>
      <button class="chip new-btn" @click="router.push('/character/new')">
        <Icon name="plus" :size="14" /> 新建
      </button>
      <button class="chip lucky-btn" @click="openRandom">
        <Icon name="gift" :size="14" /> 抽一个
      </button>
    </div>

    <div v-if="tags.length" class="tag-row">
      <button :class="['chip', 'tag-chip', { active: !tagFilter }]" @click="tagFilter = ''">全部</button>
      <button v-for="t in tags" :key="t" :class="['chip', 'tag-chip', { active: tagFilter === t }]" @click="tagFilter = tagFilter === t ? '' : t">{{ t }}</button>
    </div>

    <div v-if="list.length" class="grid">
      <CharacterCard v-for="c in list" :key="c.id" :character="c" />
    </div>
    <div v-else class="empty-tip">
      <Icon v-if="tab === 'fav'" name="bookmark" :size="34" class="empty-icon" />
      <Icon v-else name="mood" :size="34" class="empty-icon" />
      <p>
        {{
          keyword
            ? '没有找到匹配的角色'
            : tab === 'mine'
            ? '还没有自己创建的角色，点击上方「新建」试试'
            : tab === 'fav'
            ? '还没有收藏的角色，在角色卡片上点一下星标即可'
            : '角色列表为空'
        }}
      </p>
    </div>

    <input ref="importFile" type="file" accept="application/json,.json" style="display:none" @change="onImportFile" />

    <Sheet :show="searchOpen" title="搜索消息" @close="searchOpen = false">
      <div class="search-inner">
        <div class="search-input">
          <Icon name="search" :size="18" />
          <input v-model="searchKw" placeholder="搜索所有角色的对话…" autofocus />
        </div>
        <div v-if="results.length" class="sr-list">
          <button v-for="(r, i) in results.slice(0, 50)" :key="i" class="sr-item" @click="goSearchResult(r)">
            <Avatar :avatar="r.char.avatar" :name="r.char.name" :size="32" />
            <div class="sr-main">
              <div class="sr-title">{{ r.char.name }} · {{ r.msg.role === 'user' ? '你说' : r.char.name + '说' }}</div>
              <div class="sr-snippet">{{ snippet(r.msg.content) }}</div>
            </div>
          </button>
        </div>
        <div v-else-if="searchKw.trim()" class="empty-tip">没有找到包含「{{ searchKw.trim() }}」的消息</div>
        <div v-else class="empty-tip">输入关键词，搜索所有角色和对话</div>
      </div>
    </Sheet>
  </div>
</template>

<style scoped>
.top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 18px 8px;
}
.brand {
  display: flex;
  align-items: center;
  gap: 12px;
}
.logo {
  width: 46px;
  height: 46px;
  border-radius: 14px;
  background: var(--grad);
  color: #fff;
  font-size: 24px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 20px rgba(124, 108, 255, 0.35);
}
h1 {
  font-size: 20px;
  font-weight: 800;
  line-height: 1.2;
}
.top p {
  font-size: 12px;
  color: var(--text-dim);
}
.search {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 10px 18px;
  padding: 10px 14px;
  border-radius: 14px;
  background: var(--card);
  border: 1px solid var(--line);
  color: var(--text-faint);
}
.search input {
  border: none;
  background: transparent;
  padding: 0;
  box-shadow: none;
}
.search input:focus {
  box-shadow: none;
}
.luck-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin: 4px 18px 0;
  padding: 13px 16px;
  border-radius: 16px;
  color: #fff;
  box-shadow: 0 8px 22px rgba(124, 108, 255, 0.28);
  animation: luck-in 0.5s ease both;
}
@keyframes luck-in {
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: none; }
}
.luck-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.luck-emoji {
  font-size: 26px;
  line-height: 1;
  flex-shrink: 0;
}
.luck-lv {
  font-size: 14px;
  font-weight: 800;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
}
.luck-text {
  font-size: 12px;
  opacity: 0.95;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.18);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.luck-tag {
  font-size: 11px;
  opacity: 0.85;
  background: rgba(255, 255, 255, 0.22);
  padding: 3px 8px;
  border-radius: 999px;
  white-space: nowrap;
}
.recent {
  margin: 16px 18px 0;
}
.sec-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-dim);
  padding: 0 2px 8px;
  letter-spacing: 0.5px;
}
.recent-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.recent-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 14px;
  background: var(--card);
  border: 1px solid var(--line);
  text-align: left;
  transition: all 0.15s;
}
.recent-item:active {
  background: var(--card-2);
}
.recent-main {
  flex: 1;
  min-width: 0;
}
.recent-name {
  font-size: 14px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.recent-conv {
  font-size: 12px;
  font-weight: 400;
  color: var(--text-faint);
  margin-left: 4px;
}
.recent-msg {
  font-size: 12px;
  color: var(--text-dim);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 1px;
}
.recent-arrow {
  color: var(--text-faint);
}
.tabs {
  display: flex;
  gap: 8px;
  padding: 14px 18px 10px;
  align-items: center;
}
.tag-row {
  display: flex;
  gap: 8px;
  padding: 0 18px 6px;
  overflow-x: auto;
  scrollbar-width: none;
}
.tag-row::-webkit-scrollbar {
  display: none;
}
.tag-chip {
  flex-shrink: 0;
  padding: 5px 12px;
  font-size: 12px;
}
.new-btn {
  margin-left: auto;
  background: var(--grad);
  color: #fff;
  border-color: transparent;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.lucky-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--accent-a);
  border-color: rgba(124, 108, 255, 0.4);
  background: rgba(124, 108, 255, 0.08);
}
.grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 4px 18px 24px;
}
@media (min-width: 700px) {
  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
  }
}
.head-actions {
  display: flex;
  gap: 2px;
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
  max-height: 55vh;
  overflow-y: auto;
}
.sr-item {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 10px 12px;
  border-radius: 12px;
  background: var(--card);
  border: 1px solid var(--line);
  text-align: left;
}
.sr-item:active {
  background: var(--card-2);
}
.sr-main {
  flex: 1;
  min-width: 0;
}
.sr-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-dim);
}
.sr-snippet {
  font-size: 13px;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 2px;
}
.empty-icon {
  color: var(--text-faint);
  margin-bottom: 10px;
}
</style>
