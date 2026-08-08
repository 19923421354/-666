// 生成 Android 启动图标（星语 AI）：legacy png + adaptive foreground
import { writeFileSync, mkdirSync } from 'fs'
import { drawIcon } from './icon-core.mjs'

const densities = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 }
const resDir = process.argv[2]

for (const [name, size] of Object.entries(densities)) {
  const dir = `${resDir}/mipmap-${name}`
  mkdirSync(dir, { recursive: true })
  writeFileSync(`${dir}/ic_launcher.png`, drawIcon(size))
  writeFileSync(`${dir}/ic_launcher_round.png`, drawIcon(size))
  writeFileSync(`${dir}/ic_launcher_foreground.png`, drawIcon(size, { background: false, scale: 0.62 }))
  console.log('written', dir)
}
