<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { db, searchMessages, parseCharacterImport, upsertCharacter } from '../store'
import CharacterCard from '../components/CharacterCard.vue'
import Avatar from '../components/Avatar.vue'
import Sheet from '../components/Sheet.vue'

const router = useRouter()
const keyword = ref('')
const tab = ref('all')

const searchOpen = ref(false)
const searchKw = ref('')
const importFile = ref(null)
const results = computed(() => searchMessages(searchKw.value))

const list = computed(() => {
  let arr = [...db.characters]
  if (tab.value === 'mine') {
    arr = arr.filter((c) => !c.id.startsWith('preset-'))
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
</script>

<template>
  <div class="page home">
    <header class="top">
      <div class="brand">
        <div class="logo">星</div>
        <div>
          <h1>星语 AI</h1>
          <p>你的 AI 角色扮演伙伴</p>
        </div>
      </div>
      <div class="head-actions">
        <button class="icon-btn" @click="searchOpen = true" aria-label="搜索消息">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
        </button>
        <button class="icon-btn" @click="openImport" aria-label="导入角色">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"></path></svg>
        </button>
        <button class="icon-btn" @click="router.push('/settings')" aria-label="设置">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
        </button>
      </div>
    </header>

    <div class="search">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="11" r="8"></circle>
        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
      </svg>
      <input v-model="keyword" placeholder="搜索角色、介绍…" />
    </div>

    <div class="tabs">
      <button :class="['chip', { active: tab === 'all' }]" @click="tab = 'all'">全部角色</button>
      <button :class="['chip', { active: tab === 'mine' }]" @click="tab = 'mine'">我的角色</button>
      <button class="chip new-btn" @click="router.push('/character/new')">+ 新建角色</button>
    </div>

    <div v-if="list.length" class="grid">
      <CharacterCard v-for="c in list" :key="c.id" :character="c" />
    </div>
    <div v-else class="empty-tip">
      {{ keyword ? '没有找到匹配的角色' : tab === 'mine' ? '还没有自己创建的角色，点击上方「新建角色」试试' : '角色列表为空' }}
    </div>

    <input ref="importFile" type="file" accept="application/json,.json" style="display:none" @change="onImportFile" />

    <Sheet :show="searchOpen" title="搜索消息" @close="searchOpen = false">
      <div class="search-inner">
        <div class="search-input">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
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
.tabs {
  display: flex;
  gap: 8px;
  padding: 0 18px 14px;
  align-items: center;
}
.new-btn {
  margin-left: auto;
  background: var(--grad);
  color: #fff;
  border-color: transparent;
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
</style>
