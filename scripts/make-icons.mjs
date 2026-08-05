// 生成应用图标（渐变圆角方块 + 白色对话气泡），无外部依赖
import { deflateSync } from 'zlib'
import { writeFileSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'

function crc32(buf) {
  let c, crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    c = (crc ^ buf[i]) & 0xff
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

function encodePNG(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function lerp(a, b, t) {
  return Math.round(a + (b - a) * t)
}

function hexToRgb(hex) {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

function drawIcon(size) {
  const rgba = Buffer.alloc(size * size * 4)
  const c1 = hexToRgb('#7c6cff')
  const c2 = hexToRgb('#ff5fa2')
  const c3 = hexToRgb('#ffb86b')
  const r = size * 0.22
  const cx = size / 2
  const cy = size / 2

  const inRoundedRect = (x, y, rr) => {
    if (x < rr || x >= size - rr || y < rr || y >= size - rr) {
      const dx = x < rr ? rr - x : x >= size - rr ? x - (size - rr) : 0
      const dy = y < rr ? rr - y : y >= size - rr ? y - (size - rr) : 0
      return dx * dx + dy * dy <= rr * rr
    }
    return true
  }

  const inBubble = (x, y) => {
    const bw = size * 0.62
    const bh = size * 0.5
    const bx = cx - bw / 2
    const by = cy - bh / 2 - size * 0.02
    const br = bh / 2
    if (x < bx || x >= bx + bw || y < by || y >= by + bh) return false
    if (x < bx + br && y < by + br) {
      return (x - (bx + br)) ** 2 + (y - (by + br)) ** 2 <= br * br
    }
    if (x >= bx + bw - br && y < by + br) {
      return (x - (bx + bw - br)) ** 2 + (y - (by + br)) ** 2 <= br * br
    }
    if (x < bx + br && y >= by + bh - br) {
      return (x - (bx + br)) ** 2 + (y - (by + bh - br)) ** 2 <= br * br
    }
    if (x >= bx + bw - br && y >= by + bh - br) {
      return (x - (bx + bw - br)) ** 2 + (y - (by + bh - br)) ** 2 <= br * br
    }
    return true
  }

  const inTail = (x, y) => {
    const bx = cx - (size * 0.62) / 2
    const by = cy - size * 0.27
    const tx = cx - size * 0.06
    const ty = by + size * 0.5
    const dx = x - tx
    const dy = y - ty
    return dx * dx + dy * dy <= (size * 0.1) ** 2
  }

  const inDots = (x, y, i) => {
    const bx = cx - (size * 0.62) / 2
    const by = cy - size * 0.27
    const bw = size * 0.62
    const bh = size * 0.5
    const count = 3
    const dotR = size * 0.035
    const spacing = size * 0.11
    const startX = bx + bw / 2 - (spacing * (count - 1)) / 2
    const dcy = by + bh / 2
    const ddx = x - (startX + i * spacing)
    const ddy = y - dcy
    return ddx * ddx + ddy * ddy <= dotR * dotR
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r, g, b, a = 255
      const t = (x + y) / (2 * size)
      if (inRoundedRect(x, y, r)) {
        const tt = x / size
        r = lerp(c1[0], c2[0], tt)
        g = lerp(c1[1], c2[1], tt)
        b = lerp(c1[2], c2[2], tt)
      } else {
        r = g = b = 0
        a = 0
      }
      if (a > 0 && (inBubble(x, y) || inTail(x, y))) {
        const tb = y / size
        r = lerp(255, 250, tb)
        g = lerp(255, 240, tb)
        b = lerp(255, 235, tb)
        for (let i = 0; i < 3; i++) {
          if (inDots(x, y, i)) {
            const gx = 124 + (x / size) * 30
            const gy = 108 + (y / size) * 40
            r = lerp(c1[0], c3[0], x / size)
            g = gx
            b = 255 - gy
            r = lerp(c1[0], 255, x / size)
            g = lerp(c1[1], 180, x / size)
            b = lerp(c1[2], 120, x / size)
          }
        }
      }
      const idx = (y * size + x) * 4
      rgba[idx] = r
      rgba[idx + 1] = g
      rgba[idx + 2] = b
      rgba[idx + 3] = a
    }
  }
  return encodePNG(size, size, rgba)
}

const outDir = process.argv[2] || 'dist/icons'
mkdirSync(outDir, { recursive: true })
for (const s of [512, 192, 144, 96, 72, 48]) {
  const p = join(outDir, `icon-${s}.png`)
  writeFileSync(p, drawIcon(s))
  console.log('written', p)
}
