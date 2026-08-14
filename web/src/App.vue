<script setup>
import { watch, onMounted, onBeforeUnmount } from 'vue'
import { db } from './store'
import { initTTS } from './engine/tts'
import { ACCENTS } from './store'

const darkMq = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null

function applyTheme(s) {
  const t = s.theme
  const dark = t === 'system' ? !!darkMq && darkMq.matches : t === 'dark'
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')

  const root = document.documentElement.style
  const accent = ACCENTS[s.accent] || ACCENTS.default
  root.setProperty('--accent-a', accent.a)
  root.setProperty('--accent-b', accent.b)

  if (s.fontSize && s.fontSize !== 1) {
    root.setProperty('--font-scale', String(s.fontSize))
  } else {
    root.removeProperty('--font-scale')
  }
  root.setAttribute('data-bubble', s.bubbleStyle || 'rounded')
}

watch(
  () => db.settings.theme,
  () => applyTheme(db.settings),
  { immediate: true }
)
watch(
  () => db.settings.accent,
  () => applyTheme(db.settings),
  { immediate: true }
)
watch(
  () => db.settings.fontSize,
  () => applyTheme(db.settings),
  { immediate: true }
)
watch(
  () => db.settings.bubbleStyle,
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
