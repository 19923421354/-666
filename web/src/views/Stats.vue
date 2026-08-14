<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { db, totalStats, currentStreak, todayMessages } from '../store'
import Icon from '../components/Icon.vue'

const router = useRouter()

const stats = computed(() => totalStats())
const streak = computed(() => currentStreak())
const today = computed(() => todayMessages())
const totalSent = computed(() => db.stats.sent || 0)
const activeDays = computed(() => (db.stats.activeDays || []).length)

const cards = computed(() => [
  { label: '角色', value: stats.value.characters, icon: 'user', grad: 'linear-gradient(135deg,#7c6cff,#ff5fa2)' },
  { label: '对话', value: stats.value.convs, icon: 'message', grad: 'linear-gradient(135deg,#2193b0,#6dd5ed)' },
  { label: '消息', value: stats.value.msgs, icon: 'send', grad: 'linear-gradient(135deg,#f2994a,#f2c94c)' },
  { label: '累计字数', value: stats.value.chars, icon: 'file', grad: 'linear-gradient(135deg,#56ab2f,#a8e063)' },
])

const streakCards = computed(() => [
  { label: '今日消息', value: today.value, icon: 'zap' },
  { label: '连续聊天', value: streak.value + ' 天', icon: 'flame' },
  { label: '累计发送', value: totalSent.value + ' 条', icon: 'send' },
  { label: '活跃天数', value: activeDays.value + ' 天', icon: 'clock' },
])
</script>

<template>
  <div class="page stats">
    <header class="top">
      <button class="icon-btn" @click="router.back()">
        <Icon name="back" :size="20" />
      </button>
      <h2>聊天统计</h2>
      <div style="width: 38px"></div>
    </header>

    <div class="hero" v-if="streak >= 1">
      <Icon name="flame" :size="40" class="flame" :filled="true" />
      <div class="hero-text">
        <p class="hero-title">已连续聊天 {{ streak }} 天</p>
        <p class="hero-sub">保持这份热情，每天都来和 TA 们聊聊吧</p>
      </div>
    </div>

    <div class="grid2">
      <div v-for="c in cards" :key="c.label" class="stat-card" :style="{ background: c.grad }">
        <Icon :name="c.icon" :size="26" class="stat-ico" />
        <div class="stat-num">{{ c.value }}</div>
        <div class="stat-label">{{ c.label }}</div>
      </div>
    </div>

    <div class="group">
      <div class="group-title">活跃足迹</div>
      <div class="streak-grid">
        <div v-for="s in streakCards" :key="s.label" class="streak-item">
          <div class="streak-ico"><Icon :name="s.icon" :size="18" /></div>
          <div class="streak-num">{{ s.value }}</div>
          <div class="streak-label">{{ s.label }}</div>
        </div>
      </div>
    </div>

    <div class="group">
      <div class="group-title">每日消息（最近 7 天）</div>
      <div class="bars">
        <div v-for="b in weekBars" :key="b.key" class="bar-col">
          <div class="bar-val" v-if="b.count">{{ b.count }}</div>
          <div class="bar" :style="{ height: b.h + '%' }"></div>
          <div class="bar-day">{{ b.day }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { computed } from 'vue'
import { db } from '../store'

export default {
  computed: {
    weekBars() {
      const days = []
      const now = new Date()
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now)
        d.setDate(d.getDate() - i)
        days.push({
          key: `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`,
          day: '日一二三四五六'[d.getDay()],
        })
      }
      let max = 1
      const counts = {}
      for (const c of db.characters) {
        const convs = db.conversations[c.id]
        if (!convs || !convs.list) continue
        for (const conv of convs.list) {
          if (!conv.messages) continue
          for (const m of conv.messages) {
            if (!m.ts) continue
            const d = new Date(m.ts)
            const k = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
            counts[k] = (counts[k] || 0) + 1
            if (counts[k] > max) max = counts[k]
          }
        }
      }
      return days.map((d) => {
        const count = counts[d.key] || 0
        return { ...d, count, h: count ? Math.max(8, Math.round((count / max) * 100)) : 2 }
      })
    },
  },
}
</script>

<style scoped>
.top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px 4px;
}
.top h2 {
  font-size: 18px;
}
.hero {
  display: flex;
  align-items: center;
  gap: 14px;
  margin: 14px 16px 0;
  padding: 16px;
  border-radius: var(--radius);
  background: linear-gradient(120deg, rgba(124, 108, 255, 0.18), rgba(255, 95, 162, 0.14));
  border: 1px solid rgba(124, 108, 255, 0.3);
}
.flame {
  color: #ff8a3d;
  filter: drop-shadow(0 4px 12px rgba(255, 138, 61, 0.4));
}
.hero-title {
  font-size: 17px;
  font-weight: 800;
}
.hero-sub {
  font-size: 12px;
  color: var(--text-dim);
  margin-top: 2px;
}
.grid2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  padding: 14px 16px 0;
}
.stat-card {
  border-radius: var(--radius);
  padding: 14px;
  color: #fff;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
  position: relative;
  overflow: hidden;
}
.stat-ico {
  position: absolute;
  right: 10px;
  top: 10px;
  opacity: 0.55;
}
.stat-num {
  font-size: 26px;
  font-weight: 800;
}
.stat-label {
  font-size: 12px;
  opacity: 0.9;
  margin-top: 2px;
}
.group {
  margin: 14px 16px;
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 8px 14px 14px;
}
.group-title {
  font-size: 12px;
  color: var(--text-faint);
  font-weight: 700;
  padding: 6px 0 10px;
  letter-spacing: 1px;
}
.streak-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}
.streak-item {
  text-align: center;
  padding: 10px 4px;
  border-radius: 12px;
  background: var(--card-2);
}
.streak-ico {
  color: var(--accent-a);
  display: flex;
  justify-content: center;
}
.streak-num {
  font-size: 15px;
  font-weight: 800;
  margin-top: 4px;
}
.streak-label {
  font-size: 11px;
  color: var(--text-faint);
  margin-top: 2px;
}
.bars {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  height: 120px;
}
.bar-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  height: 100%;
  gap: 2px;
}
.bar {
  width: 60%;
  max-width: 28px;
  background: var(--grad);
  border-radius: 6px 6px 2px 2px;
  transition: height 0.4s;
}
.bar-val {
  font-size: 11px;
  color: var(--text-dim);
}
.bar-day {
  font-size: 11px;
  color: var(--text-faint);
}
</style>
