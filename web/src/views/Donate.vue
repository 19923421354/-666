<script setup>
import { useRouter } from 'vue-router'
const router = useRouter()
</script>

<template>
  <div class="page donate">
    <header class="top">
      <button class="icon-btn" @click="router.back()">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"></path></svg>
      </button>
      <h2>赞赏支持</h2>
      <div style="width: 38px"></div>
    </header>

    <div class="hero">
      <p class="title">如果星语 AI 让你觉得开心</p>
      <p class="sub">可以扫码支持开发者，让我有动力继续打磨它</p>
    </div>

    <div class="cards">
      <div class="pay-card">
        <div class="pay-head wechat">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8.7 4C4.9 4 2 6.6 2 9.9c0 1.9 1 3.5 2.6 4.6L4 17l2.7-1.4c.7.2 1.4.3 2 .3.4 0 .8 0 1.2-.1-.2-.5-.3-1-.3-1.5 0-2.9 2.7-5.3 6-5.3.3 0 .7 0 1 .1C15.9 6.2 12.6 4 8.7 4zM6 8.4c-.5 0-.9-.4-.9-.9s.4-.9.9-.9.9.4.9.9-.4.9-.9.9zm5 0c-.5 0-.9-.4-.9-.9s.4-.9.9-.9.9.4.9.9-.4.9-.9.9zm7-4.4c-3.3 0-6 2.3-6 5.1s2.7 5.1 6 5.1c.6 0 1.2-.1 1.7-.2L21 15.5l-1-2.1c1.3-.9 2.1-2.2 2.1-3.8 0-2.9-2.7-5.2-6-5.2zm-3.5 6.3c-.4 0-.7-.3-.7-.7s.3-.7.7-.7.7.3.7.7-.3.7-.7.7zm3.5 0c-.4 0-.7-.3-.7-.7s.3-.7.7-.7.7.3.7.7-.3.7-.7.7z"/></svg>
          微信
        </div>
        <img src="/donate/wechat.png" alt="微信收款码" />
        <p class="tip">长按识别二维码赞赏</p>
      </div>

      <div class="pay-card">
        <div class="pay-head alipay">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M21.4 16.6c-.9-.4-1.8-.8-2.6-1.1.8-1.5 1.4-3.1 1.4-4.7v-1H12v2.2h5.1c-.2 1-.7 2-1.3 2.9-1.5-.7-3.1-1.5-4.5-2.5l-1.3 1.6c1.4 1 3 1.9 4.6 2.6-.9.4-2 .6-3.1.5-2.5 0-4.7-.9-6-2.4l-1.5 1.4C6.1 18.1 8.6 19.3 11.5 19.3c1.2 0 2.3-.2 3.3-.6 1.5.9 3.2 1.5 4.9 1.5 1.7 0 3.2-.7 4.2-1.9-.7.1-1.5-.2-2.5-.7zM12 21C6.5 21 2 16.5 2 11S6.5 1 12 1s10 4.5 10 10-4.5 10-10 10z"/></svg>
          支付宝
        </div>
        <img src="/donate/alipay.jpg" alt="支付宝收款码" />
        <p class="tip">长按识别二维码赞赏</p>
      </div>
    </div>

    <div class="thanks">
      <p>每一份支持都是星语 AI 前进的动力。</p>
      <p class="faint">本页面不收集任何个人信息，赞赏完全自愿。</p>
    </div>
  </div>
</template>

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
  text-align: center;
  padding: 18px 20px 6px;
}
.hero .title {
  font-size: 17px;
  font-weight: 700;
}
.hero .sub {
  font-size: 13px;
  color: var(--text-dim);
  margin-top: 6px;
}
.cards {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 18px 16px;
}
@media (min-width: 640px) {
  .cards {
    flex-direction: row;
    justify-content: center;
    align-items: flex-start;
  }
}
.pay-card {
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 14px 14px 12px;
  text-align: center;
  max-width: 340px;
  margin: 0 auto;
}
@media (min-width: 640px) {
  .pay-card {
    flex: 1;
    max-width: 300px;
    margin: 0;
  }
}
.pay-head {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 700;
  padding-bottom: 10px;
}
.pay-head.wechat {
  color: #07c160;
}
.pay-head.alipay {
  color: #1677ff;
}
.pay-card img {
  width: 100%;
  max-width: 260px;
  border-radius: 12px;
  display: block;
  margin: 0 auto;
}
.pay-card .tip {
  font-size: 12px;
  color: var(--text-faint);
  margin-top: 10px;
}
.thanks {
  text-align: center;
  font-size: 13px;
  color: var(--text-dim);
  line-height: 1.9;
  padding: 4px 20px 30px;
}
.thanks .faint {
  color: var(--text-faint);
}
</style>
