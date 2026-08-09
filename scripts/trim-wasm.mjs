// 构建后清理：删除 vite 复制到 dist/assets 的 onnxruntime wasm（冗余副本）。
// 运行时通过 env.backends.onnx.wasm.wasmPaths='/wasm/' 从 public/wasm 加载，
// assets 中的 hashed 副本不会被使用，仅白白增大安装包约 20MB。
import { rmSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'web')
const assetsDir = join(root, 'dist', 'assets')
let removed = 0
try {
  for (const f of readdirSync(assetsDir)) {
    if (f.startsWith('ort-wasm-') && f.endsWith('.wasm')) {
      rmSync(join(assetsDir, f))
      removed++
      console.log('[trim] removed', f)
    }
  }
} catch (e) {
  console.warn('[trim] skip:', e.message)
}
console.log('[trim] done, removed', removed, 'file(s)')
