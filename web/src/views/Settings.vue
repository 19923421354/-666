<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { db, exportAll, importAll, resetAll } from '../store'
import { STYLES } from '../engine/offline'
import { APP_VERSION, checkUpdate, downloadAndInstall } from '../engine/update'

const router = useRouter()
const importOpen = ref(false)
const importText = ref('')
const resetOpen = ref(false)
const importMsg = ref('')
const fileInput = ref(null)

const checkState = ref('idle') // idle | checking | latest | update | error
const updateOpen = ref(false)
const updateInfo = ref(null)
const updateMsg = ref('')

const providers = [
  { id: 'local', name: '星语内置 AI（真·本地推理）', desc: '内置 Qwen2.5-0.5B 模型，离线运行，免费无需网络' },
  { id: 'offline', name: '轻量对话（离线兜底）', desc: '无需任何接口与网络，使用内置角色扮演引擎，响应快' },
  { id: 'ollama', name: 'Ollama 本地模型', desc: '连接你自己电脑上运行的 Ollama，完全本地、免费' },
  { id: 'openai', name: 'OpenAI 兼容接口', desc: '支持 DeepSeek / 通义 / GLM / OpenAI 等任意兼容服务' },
]

const themeOpts = [
  { id: 'system', label: '跟随系统' },
  { id: 'dark', label: '深色' },
  { id: 'light', label: '浅色' },
]

async function doCheck() {
  checkState.value = 'checking'
  updateMsg.value = ''
  updateOpen.value = true
  updateInfo.value = null
  try {
    const info = await checkUpdate()
    if (!info) {
      checkState.value = 'error'
      updateMsg.value = '无法连接更新服务器，请检查网络后重试'
      return
    }
    updateInfo.value = info
    checkState.value = info.hasUpdate ? 'update' : 'latest'
  } catch (e) {
    checkState.value = 'error'
    updateMsg.value = '检查更新失败：' + (e && e.message)
  }
}

async function doInstall() {
  if (!updateInfo.value || !updateInfo.value.apkUrl) {
    updateMsg.value = '暂未提供下载地址，请稍后再试'
    return
  }
  try {
    const r = await downloadAndInstall(updateInfo.value.apkUrl)
    updateMsg.value =
      r && r.web
        ? '已开始下载，请留意浏览器下载提示'
        : '已开始下载安装包，完成后系统将引导你完成安装'
  } catch (e) {
    updateMsg.value = '下载失败：' + (e && e.message)
  }
}

function doExport() {
  const blob = new Blob([exportAll()], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = '星语AI-备份-' + new Date().toISOString().slice(0, 10) + '.json'
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
      <div class="group-title">生成参数</div>
      <div class="row">
        <span>温度（创造度）</span>
        <span class="val">{{ Number(db.settings.local.temperature).toFixed(1) }}</span>
      </div>
      <input class="slider" type="range" min="0.1" max="1.5" step="0.1" v-model.number="db.settings.local.temperature" />
      <div class="row">
        <span>最大回复长度</span>
        <div class="inline-row">
          <input class="inline-input" type="number" min="40" step="20" v-model.number="db.settings.local.maxTokens" />
          <button class="mini-btn" :class="{ on: db.settings.local.maxTokens === 0 }" @click="db.settings.local.maxTokens = db.settings.local.maxTokens === 0 ? 220 : 0">无上限</button>
        </div>
      </div>
      <div class="row">
        <span>上下文消息条数</span>
        <select class="mini-select" v-model.number="db.settings.contextWindow">
          <option :value="10">最近 10 条</option>
          <option :value="24">最近 24 条</option>
          <option :value="50">最近 50 条</option>
          <option :value="0">全部</option>
        </select>
      </div>
      <template v-if="db.settings.provider === 'local'">
        <div class="row">
          <span>上下文 Token 上限</span>
          <select class="mini-select" v-model.number="db.settings.local.contextLimit">
            <option :value="2048">2048（省内存）</option>
            <option :value="4096">4096（推荐）</option>
            <option :value="8192">8192（完整）</option>
          </select>
        </div>
      </template>
      <div class="hint">「无上限」时模型也会在合理范围内自动停止。上下文条数越多越懂你，但生成会变慢并占用更多内存。</div>
    </div>

    <div class="group">
      <div class="group-title">外观与体验</div>
      <div class="row">
        <span>外观主题</span>
        <div class="seg">
          <button v-for="t in themeOpts" :key="t.id" :class="{ on: db.settings.theme === t.id }" @click="db.settings.theme = t.id">{{ t.label }}</button>
        </div>
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
        <p><b>星语 AI</b> v{{ APP_VERSION }}</p>
        <p>开源免费的 AI 角色扮演聊天应用。数据全部保存在本机，不收集任何个人信息。</p>
        <p>内容仅供娱乐，AI 回复由程序生成，不构成任何建议。</p>
      </div>
      <button class="row-btn" @click="doCheck">
        <span>{{ checkState === 'checking' ? '正在检查更新…' : '检查更新' }}</span>
        <span class="arrow">{{ checkState === 'checking' ? '…' : '›' }}</span>
      </button>
      <button class="row-btn" @click="router.push('/donate')">
        <span>赞赏支持开发者</span><span class="arrow">›</span>
      </button>
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

    <div class="sheet-mask" v-if="updateOpen" @click="updateOpen = false"></div>
    <div class="sheet mini" v-if="updateOpen">
      <div class="sheet-handle"></div>
      <div class="update-body">
        <template v-if="checkState === 'update' && updateInfo">
          <div class="update-title">发现新版本 v{{ updateInfo.latest }}</div>
          <div class="update-notes" v-if="updateInfo.notes">{{ updateInfo.notes }}</div>
          <button class="btn" :disabled="updateMsg && updateMsg.startsWith('已开始')" @click="doInstall">立即下载更新</button>
        </template>
        <template v-else-if="checkState === 'latest'">
          <div class="update-title">已是最新版本 v{{ APP_VERSION }}</div>
        </template>
        <template v-else-if="checkState === 'checking'">
          <div class="update-title">正在检查更新…</div>
        </template>
        <template v-else>
          <div class="update-title">{{ updateMsg || '检查更新失败' }}</div>
        </template>
        <div v-if="updateMsg" class="update-msg">{{ updateMsg }}</div>
        <button class="btn btn-ghost" @click="updateOpen = false">关闭</button>
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
.slider {
  width: 100%;
  accent-color: var(--accent-a);
  margin: 4px 0 8px;
}
.row .val {
  color: var(--text-dim);
  font-weight: 600;
  font-size: 14px;
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
.inline-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.mini-btn {
  padding: 7px 12px;
  font-size: 12px;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: var(--card-2);
  color: var(--text-dim);
  white-space: nowrap;
}
.mini-btn.on {
  border-color: var(--accent-a);
  background: rgba(124, 108, 255, 0.12);
  color: var(--accent-a);
  font-weight: 700;
}
.mini-select {
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid var(--line);
  background: var(--card-2);
  color: var(--text);
  font-size: 13px;
  max-width: 180px;
}
.seg {
  display: flex;
  gap: 4px;
  background: var(--card-2);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 3px;
}
.seg button {
  padding: 5px 10px;
  font-size: 12px;
  border-radius: 7px;
  color: var(--text-dim);
}
.seg button.on {
  background: var(--grad);
  color: #fff;
  font-weight: 700;
}
.update-body {
  padding: 6px 4px 2px;
}
.update-title {
  font-size: 16px;
  font-weight: 700;
  text-align: center;
}
.update-notes {
  font-size: 13px;
  color: var(--text-dim);
  line-height: 1.7;
  white-space: pre-wrap;
  max-height: 40vh;
  overflow-y: auto;
  margin: 12px 0;
  background: var(--card-2);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 10px;
}
.update-msg {
  font-size: 13px;
  color: var(--ok);
  text-align: center;
  margin: 10px 0 4px;
}
.update-body .btn {
  width: 100%;
  margin-top: 10px;
}
</style>
