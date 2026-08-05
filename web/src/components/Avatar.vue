<script setup>
import { computed } from 'vue'

const props = defineProps({
  avatar: { type: Object, default: () => ({}) },
  name: { type: String, default: '' },
  size: { type: Number, default: 48 },
})

const bg = computed(() => {
  const a = props.avatar || {}
  if (a.type === 'gradient') {
    return { background: `linear-gradient(135deg, ${a.from}, ${a.to})` }
  }
  if (a.type === 'image' && a.url) {
    return {
      backgroundImage: `url(${a.url})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    }
  }
  return { background: 'linear-gradient(135deg, #7c6cff, #ff5fa2)' }
})

const initial = computed(() => {
  const a = props.avatar || {}
  if (a.type === 'image' && a.url) return ''
  return a.initial || (props.name ? props.name.slice(0, 1) : '?')
})
</script>

<template>
  <div class="avatar" :style="{ width: size + 'px', height: size + 'px', ...bg }">
    <span v-if="initial">{{ initial }}</span>
  </div>
</template>

<style scoped>
.avatar {
  border-radius: 32%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 700;
  flex-shrink: 0;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
}
</style>
