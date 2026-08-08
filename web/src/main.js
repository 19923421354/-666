import { createApp } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import App from './App.vue'
import Home from './views/Home.vue'
import Chat from './views/Chat.vue'
import CharacterEdit from './views/CharacterEdit.vue'
import Settings from './views/Settings.vue'
import Donate from './views/Donate.vue'
import './styles/global.css'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', component: Home },
    { path: '/chat/:id', component: Chat },
    { path: '/character/new', component: CharacterEdit },
    { path: '/character/:id/edit', component: CharacterEdit },
    { path: '/settings', component: Settings },
    { path: '/donate', component: Donate },
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
