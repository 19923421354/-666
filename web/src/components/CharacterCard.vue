<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { db, toggleCharacterFav } from '../store'
import Avatar from './Avatar.vue'
import Icon from './Icon.vue'

const props = defineProps({
  character: { type: Object, required: true },
})
const router = useRouter()

const isPreset = computed(() => props.character.id.startsWith('preset-'))
const userMsgs = computed(() => {
  const convs = db.conversations[props.character.id]
  if (!convs || !convs.list) return 0
  let n = 0
  for (const c of convs.list) n += c.messages ? c.messages.filter((m) => m.role === 'user').length : 0
  return n
})

function open() {
  router.push({ path: `/chat/${props.character.id}` })
}
</script>

<template>
  <div class="card" @click="open">
    <div class="avatar-wrap">
      <Avatar :avatar="character.avatar" :name="character.name" :size="54" />
    </div>
    <div class="info">
      <div class="name-row">
        <div class="name">{{ character.name }}</div>
        <span v-if="isPreset" class="badge">内置</span>
      </div>
      <div class="tagline">{{ character.tagline || '未填写介绍' }}</div>
      <div class="meta">
        <template v-if="userMsgs > 0">
          <Icon name="message" :size="12" />
          聊过 {{ userMsgs }} 次
        </template>
        <template v-else>
          <Icon name="sparkles" :size="12" />
          等你开口
        </template>
      </div>
    </div>
    <button class="fav" :class="{ on: character.fav }" @click.stop="toggleCharacterFav(character.id)" :aria-label="character.fav ? '取消收藏' : '收藏角色'">
      <Icon name="star" :size="17" :filled="character.fav" />
    </button>
    <Icon name="chevronRight" :size="18" class="arrow" />
  </div>
</template>

<style scoped>
.card {
  display: flex;
  align-items: center;
  gap: 13px;
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 13px 12px 13px 14px;
  cursor: pointer;
  transition: all 0.15s;
}
.card:active {
  transform: scale(0.98);
}
.card:hover {
  border-color: var(--accent-a);
}
.info {
  flex: 1;
  min-width: 0;
}
.name-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.name {
  font-size: 16px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.badge {
  font-size: 10px;
  color: var(--accent-a);
  border: 1px solid rgba(124, 108, 255, 0.4);
  background: rgba(124, 108, 255, 0.1);
  padding: 1px 6px;
  border-radius: 999px;
  flex-shrink: 0;
}
.tagline {
  font-size: 13px;
  color: var(--text-dim);
  margin-top: 1px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.meta {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--text-faint);
  margin-top: 4px;
}
.fav {
  width: 30px;
  height: 30px;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-faint);
  transition: all 0.15s;
  flex-shrink: 0;
}
.fav:active {
  transform: scale(0.85);
}
.fav.on {
  color: #f5b944;
}
.arrow {
  color: var(--text-faint);
  flex-shrink: 0;
}
</style>
