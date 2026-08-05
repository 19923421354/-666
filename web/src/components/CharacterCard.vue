<script setup>
import { useRouter } from 'vue-router'
import Avatar from './Avatar.vue'

const props = defineProps({
  character: { type: Object, required: true },
})
const router = useRouter()

function open() {
  router.push({ path: `/chat/${props.character.id}` })
}
</script>

<template>
  <div class="card" @click="open">
    <div class="avatar-wrap">
      <Avatar :avatar="character.avatar" :name="character.name" :size="56" />
    </div>
    <div class="info">
      <div class="name">{{ character.name }}</div>
      <div class="tagline">{{ character.tagline || '未填写介绍' }}</div>
    </div>
    <div class="arrow">›</div>
  </div>
</template>

<style scoped>
.card {
  display: flex;
  align-items: center;
  gap: 14px;
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 14px 16px;
  cursor: pointer;
  transition: all 0.15s;
}
.card:active {
  transform: scale(0.98);
}
.card:hover {
  border-color: var(--accent-a);
}
.avatar-wrap {
  position: relative;
}
.info {
  flex: 1;
  min-width: 0;
}
.name {
  font-size: 16px;
  font-weight: 700;
}
.tagline {
  font-size: 13px;
  color: var(--text-dim);
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.arrow {
  color: var(--text-faint);
  font-size: 22px;
  font-weight: 300;
}
</style>
