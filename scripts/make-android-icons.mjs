// 生成 Android 启动图标（legacy png + adaptive foreground）
import { deflateSync } from 'zlib'
import { writeFileSync, mkdirSync } from 'fs'

function crc32(buf) {
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    let c = (crc ^ buf[i]) & 0xff
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    crc = (crc >>> 8) ^ c
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const typeBuf = Buffer.from(type, 'ascii')
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])))
  return Buffer.concat([len, typeBuf, data, crcBuf])
}

function encodePNG(size, rgba) {
  const raw = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const lerp = (a, b, t) => Math.round(a + (b - a) * t)
const hexToRgb = (hex) => {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

function drawIcon(size, { foreground = false, scale = 1 } = {}) {
  const rgba = Buffer.alloc(size * size * 4)
  const c1 = hexToRgb('#7c6cff')
  const c2 = hexToRgb('#ff5fa2')
  const cx = size / 2
  const cy = size / 2

  // 以 100 为基准绘制，然后按 scale 缩放（foreground 用较小的图）
  const S = size / (100 * scale)

  const r = 22 * S
  const inRoundedRect = (x, y) => {
    if (x < r || x >= size - r || y < r || y >= size - r) {
      const dx = x < r ? r - x : x >= size - r ? x - (size - r) : 0
      const dy = y < r ? r - y : y >= size - r ? y - (size - r) : 0
      return dx * dx + dy * dy <= r * r
    }
    return true
  }

  const bw = 62 * S
  const bh = 50 * S
  const bx = cx - bw / 2
  const by = cy - bh / 2 - 2 * S
  const br = bh / 2

  const inBubble = (x, y) => {
    if (x < bx || x >= bx + bw || y < by || y >= by + bh) return false
    const corners = [
      [bx + br, by + br, x, y],
      [bx + bw - br, by + br, x, y],
      [bx + br, by + bh - br, x, y],
      [bx + bw - br, by + bh - br, x, y],
    ]
    const nearCorner = corners.find(([px, py]) => x < px && y < py || (x >= px && y < py) || (x < px && y >= py) || (x >= px && y >= py))
    if (nearCorner && (x < bx + br && y < by + br || x >= bx + bw - br && y < by + br || x < bx + br && y >= by + bh - br || x >= bx + bw - br && y >= by + bh - br)) {
      const [px, py] = nearCorner
      return (x - px) ** 2 + (y - py) ** 2 <= br * br
    }
    return true
  }

  const tailR = 10 * S
  const tailCx = cx - 6 * S
  const tailCy = by + bh + 4 * S
  const inTail = (x, y) => (x - tailCx) ** 2 + (y - tailCy) ** 2 <= tailR * tailR

  const dotR = 3.5 * S
  const spacing = 11 * S
  const dotStart = bx + bw / 2 - spacing
  const dotY = cy - 2 * S
  const inDot = (x, y, i) => (x - (dotStart + i * spacing)) ** 2 + (y - dotY) ** 2 <= dotR * dotR

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r2, g, b, a = 255
      if (inRoundedRect(x, y)) {
        const t = x / size
        r2 = lerp(c1[0], c2[0], t)
        g = lerp(c1[1], c2[1], t)
        b = lerp(c1[2], c2[2], t)
      } else {
        a = 0
      }
      if (a > 0 && (inBubble(x, y) || inTail(x, y))) {
        r2 = lerp(255, 250, y / size)
        g = lerp(255, 240, y / size)
        b = lerp(255, 235, y / size)
        for (let i = 0; i < 3; i++) {
          if (inDot(x, y, i)) {
            r2 = lerp(c1[0], 255, x / size)
            g = lerp(c1[1], 180, x / size)
            b = lerp(c1[2], 120, x / size)
          }
        }
      }
      const idx = (y * size + x) * 4
      rgba[idx] = r2
      rgba[idx + 1] = g
      rgba[idx + 2] = b
      rgba[idx + 3] = a
    }
  }
  return encodePNG(size, rgba)
}

const densities = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 }
const resDir = process.argv[2]

for (const [name, size] of Object.entries(densities)) {
  const dir = `${resDir}/mipmap-${name}`
  mkdirSync(dir, { recursive: true })
  writeFileSync(`${dir}/ic_launcher.png`, drawIcon(size))
  writeFileSync(`${dir}/ic_launcher_round.png`, drawIcon(size))
  writeFileSync(`${dir}/ic_launcher_foreground.png`, drawIcon(size, { foreground: true, scale: 0.7 }))
  console.log('written', dir)
}
