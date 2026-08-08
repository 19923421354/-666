// 生成 Web 应用图标（星语 AI）：深空渐变 + 白色气泡 + 四角星
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { drawIcon } from './icon-core.mjs'

const outDir = process.argv[2] || 'dist/icons'
mkdirSync(outDir, { recursive: true })
for (const s of [512, 192, 144, 96, 72, 48]) {
  const p = join(outDir, `icon-${s}.png`)
  writeFileSync(p, drawIcon(s))
  console.log('written', p)
}
