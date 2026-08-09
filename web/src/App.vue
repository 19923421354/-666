<script setup>
import { watch, onMounted, onBeforeUnmount } from 'vue'
import { db } from './store'
import { initTTS } from './engine/tts'

const darkMq = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null

function applyTheme(s) {
  const t = s.theme
  const dark = t === 'system' ? !!darkMq && darkMq.matches : t === 'dark'
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
}

watch(
  () => db.settings.theme,
  () => applyTheme(db.settings),
  { immediate: true }
)
watch(
  () => db.settings.tts,
  () => initTTS(db.settings),
  { deep: true, immediate: true }
)

onMounted(() => {
  darkMq && darkMq.addEventListener('change', onChange)
})
onBeforeUnmount(() => {
  darkMq && darkMq.removeEventListener('change', onChange)
})

function onChange() {
  if (db.settings.theme === 'system') applyTheme(db.settings)
}
</script>

<template>
  <router-view v-slot="{ Component }">
    <transition name="fade" mode="out-in">
      <component :is="Component" />
    </transition>
  </router-view>
</template>
