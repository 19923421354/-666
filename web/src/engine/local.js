// 本地 AI 模型引擎：内置 Qwen2.5-0.5B-Instruct fp16 模型，完全离线推理。
// 通过 transformers.js + onnxruntime-web (WASM / WebGPU) 在浏览器/WebView 内运行，无需服务器、无需 API。

import { reactive } from 'vue'

export const MODEL_ID = 'Qwen2.5-0.5B-Instruct'
export const DTYPE = 'fp16'
export const MODEL_LABEL = 'Qwen2.5-0.5B（内置）'

export const modelState = reactive({
  status: 'idle', // idle | loading | ready | error
  error: '',
  device: '',
  progress: { loaded: 0, total: 0, text: '' },
})

let pipePromise = null
let pipeInstance = null

// 动态加载 transformers.js（体积大，按需加载）
async function getTransformers() {
  if (!window.__XY_TFM_MODULE__) {
    const mod = await import('@huggingface/transformers')
    const { env } = mod
    env.allowRemoteModels = false
    env.localModelPath = '/models/'
    env.backends.onnx.wasm.wasmPaths = '/wasm/'
    env.backends.onnx.wasm.proxy = false
    window.__XY_TFM_MODULE__ = mod
  }
  return window.__XY_TFM_MODULE__
}

export function isLocalReady() {
  return modelState.status === 'ready' && !!pipeInstance
}

function supportsWebGPU() {
  return typeof navigator !== 'undefined' && !!navigator.gpu
}

export async function loadModel() {
  if (pipeInstance) return pipeInstance
  if (pipePromise) return pipePromise

  modelState.status = 'loading'
  modelState.error = ''
  pipePromise = (async () => {
    const { pipeline } = await getTransformers()
    const device = supportsWebGPU() ? 'webgpu' : 'wasm'
    try {
      pipeInstance = await createPipeline(pipeline, device)
      modelState.device = device
      modelState.status = 'ready'
      modelState.progress = { loaded: 0, total: 0, text: '' }
      return pipeInstance
    } catch (e) {
      if (device === 'webgpu') {
        // WebGPU 不可用则回退 WASM
        try {
          pipeInstance = await createPipeline(pipeline, 'wasm')
          modelState.device = 'wasm'
          modelState.status = 'ready'
          modelState.progress = { loaded: 0, total: 0, text: '' }
          return pipeInstance
        } catch (e2) {
          throw e2
        }
      }
      throw e
    }
  })()

  pipePromise.catch((e) => {
    modelState.status = 'error'
    modelState.error = (e && e.message) || String(e)
    pipePromise = null
  })
  return pipePromise
}

async function createPipeline(pipeline, device) {
  modelState.device = device
  modelState.progress = { loaded: 0, total: 0, text: '准备加载…' }
  return pipeline('text-generation', MODEL_ID, {
    dtype: DTYPE,
    device,
    progress_callback: (p) => {
      if (!p) return
      const loaded = p.loaded || 0
      const total = p.total || 0
      const name = p.file || ''
      modelState.progress = {
        loaded,
        total,
        text: name.includes('onnx') ? `加载模型权重 ${Math.round((loaded / total) * 100)}%` : '初始化推理环境…',
      }
    },
  })
}

export function resetModel() {
  pipePromise = null
  pipeInstance = null
  modelState.status = 'idle'
  modelState.error = ''
  modelState.progress = { loaded: 0, total: 0, text: '' }
}

// 生成回复（支持流式与中止）
export async function generate(messages, opts = {}) {
  const { maxTokens = 220, temperature = 0.8, onDelta, signal } = opts
  const gen = await loadModel()
  const { TextStreamer } = window.__XY_TFM_MODULE__

  // 0 表示无上限，使用一个宽松值，模型遇到结束符会自行停止
  const maxNew = maxTokens > 0 ? maxTokens : 2048

  // 上下文 Token 预算：按字符粗略估算，超限时从最早的消息开始裁剪（保留 system 与最近消息）
  const budget = (Number(opts.contextLimit) || 4096) * 2
  let input = messages
  if (budget > 0) {
    let total = 0
    const kept = []
    for (let i = messages.length - 1; i >= 0; i--) {
      const cost = (messages[i].content || '').length
      if (kept.length > 0 && total + cost > budget) continue
      total += cost
      kept.unshift(messages[i])
    }
    if (messages[0] && messages[0].role === 'system' && kept[0] !== messages[0]) {
      kept.unshift(messages[0])
    }
    input = kept
  }

  let aborted = false
  const abortHandler = () => {
    aborted = true
  }
  if (signal) {
    if (signal.aborted) throw { aborted: true }
    signal.addEventListener('abort', abortHandler, { once: true })
  }

  try {
    const streamer = new TextStreamer(gen.tokenizer, {
      skip_prompt: true,
      skip_special_tokens: true,
      callback_function: (text) => {
        if (aborted) throw { aborted: true }
        if (onDelta) onDelta(text)
      },
    })

    const output = await gen(input, {
      max_new_tokens: maxNew,
      do_sample: true,
      temperature,
      top_p: 0.95,
      streamer,
    })

    const last = output && output[0] && output[0].generated_text
    const content = Array.isArray(last) ? (last.at(-1) || {}).content || '' : ''
    return content
  } finally {
    if (signal) signal.removeEventListener('abort', abortHandler)
  }
}
