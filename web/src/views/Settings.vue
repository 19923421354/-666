<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { db, exportAll, importAll, resetAll } from '../store'
import { STYLES } from '../engine/offline'

const router = useRouter()
const importOpen = ref(false)
const importText = ref('')
const resetOpen = ref(false)
const importMsg = ref('')
const fileInput = ref(null)

const providers = [
  { id: 'offline', name: '本地内置对话（免费离线）', desc: '无需任何接口与网络，使用内置角色扮演引擎' },
  { id: 'ollama', name: 'Ollama 本地模型', desc: '连接你自己电脑上运行的 Ollama，完全本地、免费' },
  { id: 'openai', name: 'OpenAI 兼容接口', desc: '支持 DeepSeek / 通义 / GLM / OpenAI 等任意兼容服务' },
]

function doExport() {
  const blob = new Blob([exportAll()], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = '幻语AI-备份-' + new Date().toISOString().slice(0, 10) + '.json'
  a.click()
  URL.revokeObjectURL(url)
}

function onImportFile(e) {
  const file = e.target.files && e.target.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    const r = importAll(String(reader.result))
    importMsg.value = r.ok ? '导入成功' : '导入失败：' + r.msg
    setTimeout(() => (importMsg.value = ''), 2500)
  }
  reader.readAsText(file)
}

function doReset() {
  resetAll()
  resetOpen.value = false
  router.push('/')
}
</script>

<template>
  <div class="page settings">
    <header class="top">
      <button class="icon-btn" @click="router.back()">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"></path></svg>
      </button>
      <h2>设置</h2>
      <div style="width: 38px"></div>
    </header>

    <div class="group">
      <div class="group-title">对话引擎</div>
      <div class="opts">
        <button v-for="p in providers" :key="p.id" :class="['opt', { active: db.settings.provider === p.id }]" @click="db.settings.provider = p.id">
          <div class="opt-name">{{ p.name }}</div>
          <div class="opt-desc">{{ p.desc }}</div>
        </button>
      </div>

      <template v-if="db.settings.provider === 'ollama'">
        <div class="field">
          <label>Ollama 服务地址</label>
          <input v-model="db.settings.ollama.baseUrl" placeholder="http://localhost:11434/v1" />
          <div class="hint">在电脑上运行 Ollama 后，手机连接同一 Wi-Fi 时填电脑局域网地址。若为本机访问可保持默认。</div>
        </div>
        <div class="field">
          <label>模型名称</label>
          <input v-model="db.settings.ollama.model" placeholder="例如 qwen2.5:7b / llama3.2" />
          <div class="hint">留空使用默认模型。首次使用前需执行 ollama pull 拉取模型。</div>
        </div>
      </template>

      <template v-if="db.settings.provider === 'openai'">
        <div class="field">
          <label>接口地址</label>
          <input v-model="db.settings.openai.baseUrl" placeholder="https://api.deepseek.com/v1" />
        </div>
        <div class="field">
          <label>API Key</label>
          <input v-model="db.settings.openai.apiKey" type="password" placeholder="sk-…" />
          <div class="hint">Key 只保存在本机，不会上传。无需任何接口时请选择「本地内置对话」。</div>
        </div>
        <div class="field">
          <label>模型名称</label>
          <input v-model="db.settings.openai.model" placeholder="例如 deepseek-chat / gpt-4o-mini" />
        </div>
      </template>
    </div>

    <div class="group">
      <div class="group-title">外观与体验</div>
      <div class="row">
        <span>深色模式</span>
        <button class="switch" :class="{ on: db.settings.theme === 'dark' }" @click="db.settings.theme = db.settings.theme === 'dark' ? 'light' : 'dark'"><i></i></button>
      </div>
      <div class="row">
        <span>语音朗读</span>
        <button class="switch" :class="{ on: db.settings.tts.enabled }" @click="db.settings.tts.enabled = !db.settings.tts.enabled"><i></i></button>
      </div>
      <div class="row">
        <span>我的称呼</span>
        <input class="inline-input" v-model="db.settings.userName" maxlength="8" placeholder="例如：阿明" />
      </div>
    </div>

    <div class="group">
      <div class="group-title">数据管理</div>
      <button class="row-btn" @click="doExport">
        <span>导出备份</span><span class="arrow">›</span>
      </button>
      <button class="row-btn" @click="fileInput.click()">
        <span>导入备份</span><span class="arrow">›</span>
      </button>
      <input ref="fileInput" type="file" accept="application/json,.json" style="display:none" @change="onImportFile" />
      <button class="row-btn danger" @click="resetOpen = true">
        <span>清空所有数据</span><span class="arrow">›</span>
      </button>
      <div v-if="importMsg" class="import-msg">{{ importMsg }}</div>
    </div>

    <div class="group">
      <div class="group-title">关于</div>
      <div class="about">
        <p><b>幻语 AI</b> v1.0.0</p>
        <p>开源免费的 AI 角色扮演聊天应用。数据全部保存在本机，不收集任何个人信息。</p>
        <p>内容仅供娱乐，AI 回复由程序生成，不构成任何建议。</p>
      </div>
    </div>

    <div class="bottom-space"></div>

    <div class="fixed-save" v-if="false"></div>

    <div class="sheet-mask" v-if="resetOpen" @click="resetOpen = false"></div>
    <div class="sheet mini" v-if="resetOpen">
      <div class="sheet-handle"></div>
      <div class="confirm-text">将清空全部角色与对话记录，且无法恢复。确定吗？</div>
      <div class="sheet-actions">
        <button class="btn btn-ghost" @click="resetOpen = false">取消</button>
        <button class="btn btn-danger" @click="doReset">确认清空</button>
      </div>
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
.group {
  margin: 14px 16px;
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 8px 14px;
}
.group-title {
  font-size: 12px;
  color: var(--text-faint);
  font-weight: 700;
  padding: 6px 0 8px;
  letter-spacing: 1px;
}
.opts {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}
.opt {
  text-align: left;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid var(--line);
  background: var(--card-2);
  transition: all 0.15s;
}
.opt.active {
  border-color: var(--accent-a);
  background: rgba(124, 108, 255, 0.1);
}
.opt-name {
  font-weight: 600;
  font-size: 14px;
}
.opt-desc {
  font-size: 12px;
  color: var(--text-dim);
  margin-top: 2px;
}
.field {
  margin-bottom: 12px;
}
.field label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-dim);
  margin-bottom: 6px;
}
.hint {
  font-size: 12px;
  color: var(--text-faint);
  margin-top: 4px;
}
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0;
  font-size: 14px;
  gap: 12px;
}
.inline-input {
  width: 140px;
  padding: 8px 12px;
}
.switch {
  width: 46px;
  height: 26px;
  border-radius: 999px;
  background: var(--card-2);
  border: 1px solid var(--line);
  position: relative;
  transition: all 0.2s;
  flex-shrink: 0;
}
.switch i {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--text-faint);
  transition: all 0.2s;
}
.switch.on {
  background: var(--grad);
  border-color: transparent;
}
.switch.on i {
  left: 22px;
  background: #fff;
}
.row-btn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 12px 2px;
  font-size: 14px;
  border-bottom: 1px solid var(--line);
}
.row-btn:last-child {
  border-bottom: none;
}
.row-btn .arrow {
  color: var(--text-faint);
  font-size: 20px;
}
.row-btn.danger {
  color: var(--danger);
}
.import-msg {
  font-size: 13px;
  color: var(--ok);
  padding: 6px 0;
}
.about {
  font-size: 13px;
  color: var(--text-dim);
  line-height: 1.8;
  padding: 6px 0 10px;
}
.about b {
  color: var(--text);
}
.bottom-space {
  height: 30px;
}
.confirm-text {
  text-align: center;
  font-size: 15px;
  padding: 8px 0 2px;
}
.sheet-actions {
  display: flex;
  gap: 10px;
  margin-top: 14px;
}
.sheet-actions .btn {
  flex: 1;
}
.sheet.mini {
  max-width: 420px;
}
</style>
