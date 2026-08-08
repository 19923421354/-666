// 共享图标绘制核心：深空渐变圆角底 + 白色对话气泡 + 四角星（星语 AI）
import { deflateSync } from 'zlib'

export function crc32(buf) {
  let c, crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    c = (crc ^ buf[i]) & 0xff
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    crc = (crc >>> 8) ^ c
  }
  return (crc ^ 0xffffffff) >>> 0
}

export function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const typeBuf = Buffer.from(type, 'ascii')
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])))
  return Buffer.concat([len, typeBuf, data, crcBuf])
}

export function encodePNG(width, height, rgba) {
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

export const lerp = (a, b, t) => Math.round(a + (b - a) * t)
export const hexToRgb = (hex) => {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

// 四角星半径函数（tipRatio 控制对角线凹陷）
function starRadius(theta, R, tipRatio, power) {
  const c = Math.pow(Math.abs(Math.cos(2 * theta)), power)
  return R * (tipRatio + (1 - tipRatio) * c)
}

export function inStar(x, y, cx, cy, R, tipRatio = 0.32, power = 2) {
  const dx = x - cx
  const dy = y - cy
  const dist = Math.sqrt(dx * dx + dy * dy)
  if (dist === 0) return true
  const theta = Math.atan2(dy, dx)
  return dist <= starRadius(theta, R, tipRatio, power)
}

// 生成图标：opts.background 是否画渐变圆角底；opts.scale 以 100 为基准的整体缩放
export function drawIcon(size, { background = true, scale = 1 } = {}) {
  const rgba = Buffer.alloc(size * size * 4)
  const bg1 = hexToRgb('#160b2e')
  const bg2 = hexToRgb('#4c1d95')
  const star1 = hexToRgb('#c4b5fd')
  const star2 = hexToRgb('#f0abfc')
  const star3 = hexToRgb('#f472b6')
  const cx = size / 2
  const cy = size / 2
  const S = size / (100 * scale)

  const radius = 22 * S
  const inRoundedRect = (x, y) => {
    if (x < radius || x >= size - radius || y < radius || y >= size - radius) {
      const dx = x < radius ? radius - x : x >= size - radius ? x - (size - radius) : 0
      const dy = y < radius ? radius - y : y >= size - radius ? y - (size - radius) : 0
      return dx * dx + dy * dy <= radius * radius
    }
    return true
  }

  // 白色对话气泡（含左下角小尾巴）
  const bw = 66 * S
  const bh = 52 * S
  const bx = cx - bw / 2
  const by = cy - bh / 2
  const br = bh / 2
  const inBubble = (x, y) => {
    const qx = Math.min(Math.max(x, bx + br), bx + bw - br)
    const qy = Math.min(Math.max(y, by + br), by + bh - br)
    const dx = x - qx
    const dy = y - qy
    if (dx * dx + dy * dy > br * br) return false
    if (x >= bx + bw - br && y >= by + bh - br) return false
    return true
  }
  const tailCx = bx + bw * 0.24
  const tailCy = by + bh + 6 * S
  const inTail = (x, y) => (x - tailCx) ** 2 + (y - tailCy) ** 2 <= (9 * S) ** 2

  // 气泡内四角星
  const starR = 20 * S

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r, g, b, a = 0
      const inBg = !background || inRoundedRect(x, y)
      if (inBg) {
        const tt = (x + y) / (2 * size)
        r = lerp(bg1[0], bg2[0], tt)
        g = lerp(bg1[1], bg2[1], tt)
        b = lerp(bg1[2], bg2[2], tt)
        a = 255
      }
      if (inBubble(x, y) || inTail(x, y)) {
        const tb = y / size
        r = lerp(255, 246, tb)
        g = lerp(255, 244, tb)
        b = lerp(255, 250, tb)
        a = 255
      }
      if (inStar(x, y, cx, cy - 1 * S, starR)) {
        const tt = x / size
        let t2 = 0.35 + 0.65 * ((x - (cx - starR)) / (2 * starR))
        t2 = Math.max(0, Math.min(1, t2))
        r = lerp(star1[0], star2[0], t2)
        g = lerp(star1[1], star2[1], t2)
        b = lerp(star1[2], star2[2], t2)
        a = 255
        if (t2 > 0.6) {
          r = lerp(star2[0], star3[0], (t2 - 0.6) / 0.4)
          g = lerp(star2[1], star3[1], (t2 - 0.6) / 0.4)
          b = lerp(star2[2], star3[2], (t2 - 0.6) / 0.4)
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
