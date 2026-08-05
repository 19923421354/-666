<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { db } from '../store'
import CharacterCard from '../components/CharacterCard.vue'

const router = useRouter()
const keyword = ref('')
const tab = ref('all')

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
</script>

<template>
  <div class="page home">
    <header class="top">
      <div class="brand">
        <div class="logo">幻</div>
        <div>
          <h1>幻语 AI</h1>
          <p>你的 AI 角色扮演伙伴</p>
        </div>
      </div>
      <button class="icon-btn" @click="router.push('/settings')" aria-label="设置">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
        </svg>
      </button>
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
</style>
