<script setup>
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { db, upsertCharacter, deleteCharacter, uid, parseCharacterImport } from '../store'
import { STYLES } from '../engine/offline'
import { GRADIENT_PRESETS } from '../data/presets'
import Avatar from '../components/Avatar.vue'
import Sheet from '../components/Sheet.vue'
import Icon from '../components/Icon.vue'

const route = useRoute()
const router = useRouter()

const editing = computed(() => {
  if (route.params.id && route.params.id !== 'new') {
    return db.characters.find((c) => c.id === route.params.id)
  }
  return null
})

const form = ref({
  id: '',
  name: '',
  tagline: '',
  style: 'gentle',
  styleDesc: '',
  persona: '',
  world: '',
  greeting: '',
  exampleDialogs: '',
  avatar: { type: 'gradient', from: GRADIENT_PRESETS[0][0], to: GRADIENT_PRESETS[0][1] },
})

if (editing.value) {
  const c = editing.value
  form.value = {
    id: c.id,
    name: c.name,
    tagline: c.tagline || '',
    style: c.style || 'gentle',
    styleDesc: c.styleDesc || '',
    persona: c.persona || '',
    world: c.world || '',
    greeting: c.greeting || '',
    exampleDialogs: Array.isArray(c.exampleDialogs) ? c.exampleDialogs.join('\n\n') : (c.exampleDialogs || ''),
    avatar: c.avatar || form.value.avatar,
  }
}

const confirmOpen = ref(false)
const avatarMode = ref('gradient')
const fileInput = ref(null)
const importInput = ref(null)

function currentObject() {
  return {
    id: form.value.id || uid(),
    name: form.value.name.trim(),
    tagline: form.value.tagline.trim(),
    style: form.value.style,
    styleDesc: form.value.styleDesc.trim(),
    persona: form.value.persona.trim(),
    world: form.value.world.trim(),
    greeting: form.value.greeting.trim(),
    exampleDialogs: form.value.exampleDialogs
      .split(/\n{2,}/)
      .map((s) => s.trim())
      .filter(Boolean),
    avatar: { ...form.value.avatar, initial: form.value.avatar.type === 'gradient' ? form.value.name.slice(0, 1) : undefined },
    updatedAt: Date.now(),
  }
}

function exportCharacter() {
  const c = currentObject()
  if (!c.name) {
    alert('请先填写角色名称')
    return
  }
  const blob = new Blob(
    [JSON.stringify({ app: 'xingyu-chat', type: 'character', version: 1, character: c }, null, 2)],
    { type: 'application/json' }
  )
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${c.name}-角色卡.json`
  a.click()
  URL.revokeObjectURL(url)
}

function onImportChar(e) {
  const file = e.target.files && e.target.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    try {
      const imported = parseCharacterImport(String(reader.result))
      upsertCharacter(imported)
      router.replace({ path: `/chat/${imported.id}` })
    } catch (err) {
      alert('解析角色卡失败：' + ((err && err.message) || err))
    }
  }
  reader.readAsText(file)
}

function pickGradient([from, to]) {
  form.value.avatar = { type: 'gradient', from, to, initial: form.value.name.slice(0, 1) || '幻' }
}

function onAvatarUpload(e) {
  const file = e.target.files && e.target.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    const img = new Image()
    img.onload = () => {
      const size = 128
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')
      const scale = Math.max(size / img.width, size / img.height)
      const w = img.width * scale
      const h = img.height * scale
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h)
      form.value.avatar = { type: 'image', url: canvas.toDataURL('image/jpeg', 0.82) }
    }
    img.src = reader.result
  }
  reader.readAsDataURL(file)
}

function save() {
  if (!form.value.name.trim()) {
    alert('请填写角色名称')
    return
  }
  const c = currentObject()
  c.id = form.value.id || uid()
  upsertCharacter(c)
  router.push({ path: `/chat/${c.id}` })
}

function remove() {
  deleteCharacter(form.value.id)
  router.push('/')
}
</script>

<template>
  <div class="page edit">
    <header class="top">
      <button class="icon-btn" @click="router.back()">
        <Icon name="back" :size="20" />
      </button>
      <h2>{{ editing ? '编辑角色' : '新建角色' }}</h2>
      <div style="width: 38px"></div>
    </header>

    <div class="form">
      <div class="avatar-pick">
        <div class="avatar-preview" @click="avatarMode = avatarMode === 'gradient' ? 'image' : 'gradient'">
          <Avatar :avatar="form.avatar" :name="form.name" :size="84" />
          <div class="avatar-edit">更换形象</div>
        </div>
        <template v-if="avatarMode === 'gradient'">
          <div class="grad-row">
            <button v-for="g in GRADIENT_PRESETS" :key="g[0]" class="grad" :style="{ background: `linear-gradient(135deg, ${g[0]}, ${g[1]})` }" @click="pickGradient(g)"></button>
          </div>
          <div class="avatar-ops">
            <button class="btn btn-ghost btn-sm" @click="pickGradient(GRADIENT_PRESETS[Math.floor(Math.random() * GRADIENT_PRESETS.length)])">
              <Icon name="refresh" :size="14" /> 随机配色
            </button>
            <button class="btn btn-ghost btn-sm" @click="fileInput.click()">
              <Icon name="upload" :size="14" /> 上传图片
            </button>
          </div>
        </template>
        <template v-else>
          <input ref="fileInput" type="file" accept="image/*" style="display:none" @change="onAvatarUpload" />
          <button class="btn btn-ghost btn-sm" @click="fileInput.click()">选择图片</button>
          <button class="btn btn-ghost btn-sm" @click="avatarMode = 'gradient'">用渐变色</button>
        </template>
      </div>

      <div class="field">
        <label>角色名称 *</label>
        <input v-model="form.name" maxlength="12" placeholder="例如：小咪" />
      </div>

      <div class="field">
        <label>一句话介绍</label>
        <input v-model="form.tagline" maxlength="30" placeholder="例如：粘人又爱撒娇的猫娘室友" />
      </div>

      <div class="field">
        <label>性格风格</label>
        <div class="chip-row">
          <button v-for="s in STYLES" :key="s.id" :class="['chip', { active: form.style === s.id }]" @click="form.style = s.id">{{ s.name }}</button>
        </div>
      </div>

      <div class="field">
        <label>风格描述（用于接口模式）</label>
        <textarea v-model="form.styleDesc" rows="2" placeholder='描述角色的语气与说话方式，例如：说话温柔，爱用"喵"做尾音'></textarea>
      </div>

      <div class="field">
        <label>角色设定（人设）</label>
        <textarea v-model="form.persona" rows="6" placeholder="描述角色的身份、性格、经历与说话习惯。写得更具体，角色会更生动。" />
      </div>

      <div class="field">
        <label>世界背景</label>
        <textarea v-model="form.world" rows="3" placeholder="角色生活的世界、场景与氛围（可选）"></textarea>
      </div>

      <div class="field">
        <label>开场白</label>
        <textarea v-model="form.greeting" rows="2" placeholder="角色见到你时说的第一句话"></textarea>
      </div>

      <div class="field">
        <label>示例对话（用空行分隔多组，前缀写"用户："和角色名）</label>
        <textarea v-model="form.exampleDialogs" rows="5" placeholder="用户：你好呀
小咪：喵～你也好呀，我等你好久啦"></textarea>
      </div>

      <div class="actions">
        <button v-if="editing" class="btn btn-danger" @click="confirmOpen = true">删除角色</button>
        <button class="btn btn-ghost" @click="exportCharacter">导出卡片</button>
        <button class="btn btn-ghost" @click="importInput.click()">导入卡片</button>
        <button class="btn btn-primary" @click="save">保存并开始聊天</button>
      </div>
      <input ref="importInput" type="file" accept="application/json,.json" style="display:none" @change="onImportChar" />
    </div>

    <Sheet :show="confirmOpen" @close="confirmOpen = false">
      <div class="confirm-text">删除角色将同时删除所有对话记录，确定吗？</div>
      <div class="sheet-actions">
        <button class="btn btn-ghost" @click="confirmOpen = false">取消</button>
        <button class="btn btn-danger" @click="remove">确认删除</button>
      </div>
    </Sheet>
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
.form {
  padding: 10px 18px 30px;
}
.avatar-pick {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}
.avatar-preview {
  position: relative;
  cursor: pointer;
}
.avatar-edit {
  position: absolute;
  bottom: -6px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  font-size: 11px;
  padding: 3px 10px;
  border-radius: 999px;
  white-space: nowrap;
}
.grad-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
}
.avatar-ops {
  display: flex;
  gap: 8px;
  justify-content: center;
}
.avatar-ops .btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.grad {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 2px solid transparent;
}
.grad:active {
  transform: scale(0.9);
}
.btn-sm {
  padding: 7px 14px;
  font-size: 13px;
}
.actions {
  display: flex;
  gap: 10px;
  margin-top: 8px;
}
.actions .btn {
  flex: 1;
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
</style>
