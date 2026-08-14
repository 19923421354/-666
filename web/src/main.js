import { createApp } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import App from './App.vue'
import Home from './views/Home.vue'
import './styles/global.css'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', component: Home },
    { path: '/chat/:id', component: () => import('./views/Chat.vue') },
    { path: '/character/new', component: () => import('./views/CharacterEdit.vue') },
    { path: '/character/:id/edit', component: () => import('./views/CharacterEdit.vue') },
    { path: '/settings', component: () => import('./views/Settings.vue') },
    { path: '/stats', component: () => import('./views/Stats.vue') },
    { path: '/donate', component: () => import('./views/Donate.vue') },
  ],
})

createApp(App).use(router).mount('#app')

if (typeof Capacitor === 'undefined' || !Capacitor.isNativePlatform()) {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    })
  }
}
