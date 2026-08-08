// 本地 AI 模型引擎：内置 Qwen2.5-0.5B-Instruct fp16 模型，完全离线推理。
// 通过 transformers.js + onnxruntime-web (WASM) 在浏览器/WebView 内运行，无需服务器、无需 API。

import { reactive } from 'vue'

export const MODEL_ID = 'Qwen2.5-0.5B-Instruct'
export const DTYPE = 'fp16'
export const MODEL_LABEL = 'Qwen2.5-0.5B（内置）'

export const modelState = reactive({
  status: 'idle', // idle | loading | ready | error
  error: '',
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

export async function loadModel() {
  if (pipeInstance) return pipeInstance
  if (pipePromise) return pipePromise

  modelState.status = 'loading'
  modelState.error = ''
  pipePromise = (async () => {
    try {
      const { pipeline } = await getTransformers()
      const gen = await pipeline('text-generation', MODEL_ID, {
        dtype: DTYPE,
        device: 'wasm',
      })
      pipeInstance = gen
      modelState.status = 'ready'
      return gen
    } catch (e) {
      modelState.status = 'error'
      modelState.error = (e && e.message) || String(e)
      pipePromise = null
      throw e
    }
  })()
  return pipePromise
}

// 生成回复（支持流式与中止）
export async function generate(messages, opts = {}) {
  const { maxTokens = 220, temperature = 0.8, onDelta, signal } = opts
  const gen = await loadModel()
  const { TextStreamer } = window.__XY_TFM_MODULE__

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

    const output = await gen(messages, {
      max_new_tokens: maxTokens,
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
