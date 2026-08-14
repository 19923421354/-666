<script setup>
import { useRouter } from 'vue-router'
import Icon from '../components/Icon.vue'
const router = useRouter()
</script>

<template>
  <div class="page donate">
    <header class="top">
      <button class="icon-btn" @click="router.back()">
        <Icon name="back" :size="20" />
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
          <Icon name="message" :size="18" />
          微信
        </div>
        <img src="/donate/wechat.png" alt="微信收款码" />
        <p class="tip">长按识别二维码赞赏</p>
      </div>

      <div class="pay-card">
        <div class="pay-head alipay">
          <Icon name="check" :size="18" />
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
