<script setup>
import { watch } from 'vue'
import { db } from './store'
import { initTTS } from './engine/tts'

watch(
  () => db.settings,
  (s) => {
    document.documentElement.setAttribute('data-theme', s.theme === 'light' ? 'light' : 'dark')
    initTTS(s)
  },
  { immediate: true, deep: true }
)
</script>

<template>
  <router-view v-slot="{ Component }">
    <transition name="fade" mode="out-in">
      <component :is="Component" />
    </transition>
  </router-view>
</template>
