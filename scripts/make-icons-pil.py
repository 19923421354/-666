#!/usr/bin/env python3
# 星语 AI 高清图标生成器（PIL + numpy，4x 超采样抗锯齿）
# 设计：深空径向渐变圆角底 + 紫色柔光 + 白色毛玻璃对话气泡 + 渐变色四角星 + 星点
import numpy as np
from PIL import Image
import os, sys

SS = 4  # 超采样倍数

def lerp(a, b, t):
    t = np.clip(t, 0, 1)
    return a[None, None, :] * (1 - t[..., None]) + b[None, None, :] * t[..., None]

def rect_mask(x, y, x0, y0, x1, y1, r):
    qx = np.clip(x, x0 + r, x1 - r)
    qy = np.clip(y, y0 + r, y1 - r)
    return (x - qx) ** 2 + (y - qy) ** 2 <= r * r

def circle_mask(x, y, cx, cy, r):
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r

def star_mask(x, y, cx, cy, R, tip=0.34, power=2.2):
    dx = x - cx
    dy = y - cy
    dist = np.hypot(dx, dy)
    theta = np.arctan2(dy, dx)
    c = np.abs(np.cos(2 * theta)) ** power
    r = R * (tip + (1 - tip) * c)
    return dist <= r

def draw(size, mode):
    S = size * SS
    yy, xx = np.mgrid[0:S, 0:S].astype(np.float64)
    x = xx / S
    y = yy / S

    dark = np.array([0.055, 0.028, 0.129])      # #160b2e
    deep = np.array([0.298, 0.114, 0.584])      # #4c1d95
    purple = np.array([0.486, 0.424, 0.992])    # #7c6cff 高光
    star1 = np.array([0.769, 0.710, 0.992])     # #c4b5fd
    star2 = np.array([0.941, 0.671, 0.988])     # #f0abfc
    star3 = np.array([0.957, 0.447, 0.714])     # #f472b6
    white = np.array([1.0, 1.0, 1.0])

    if mode == 'fg':
        # 前景：透明底，元素居中占安全区（自适应图标）
        cx, cy = 0.5, 0.5
        g_r = 0.34
        bx0, bx1, by0, by1 = 0.21, 0.79, 0.33, 0.67
        b_r = 0.05
        tail_cx, tail_cy, tail_r = 0.34, 0.70, 0.04
        star_r = 0.16
        star_cy = 0.47
        dots = [(0.26, 0.26, 0.018), (0.74, 0.28, 0.014), (0.76, 0.66, 0.017), (0.27, 0.72, 0.013)]
        rgb = np.zeros((S, S, 3))
        alpha = np.zeros((S, S))
    else:
        # 完整图标：圆角渐变底
        cx, cy = 0.5, 0.48
        g_r = 0.40
        bx0, bx1, by0, by1 = 0.245, 0.755, 0.315, 0.655
        b_r = 0.07
        tail_cx, tail_cy, tail_r = 0.36, 0.69, 0.045
        star_r = 0.135
        star_cy = 0.46
        dots = [(0.18, 0.20, 0.014), (0.82, 0.24, 0.011), (0.84, 0.72, 0.015), (0.16, 0.76, 0.012),
                (0.50, 0.15, 0.010), (0.66, 0.86, 0.011)]
        # 底
        t = (x + y) * 0.5
        bg = lerp(dark, deep, t * 1.15 - 0.05)
        d = np.hypot(x - cx, y - cy)
        glow = np.exp(-((d / 0.44) ** 2))
        bg = bg + purple * glow[..., None] * 0.22
        bg = np.clip(bg, 0, 1)
        mask = rect_mask(x, y, 0.0, 0.0, 1.0, 1.0, 0.22)
        rgb = bg.copy()
        alpha = mask.astype(np.float64)

    # 中央紫色柔光（星周围）
    d = np.hypot(x - cx, y - cy)
    glow2 = np.exp(-((d / g_r) ** 2))
    rgb = rgb + purple * glow2[..., None] * 0.18
    rgb = np.clip(rgb, 0, 1)

    # 小星点
    for (dx, dy, rr) in dots:
        dm = circle_mask(x, y, dx, dy, rr)
        rgb[dm] = rgb[dm] * 0.9 + white * 0.55
        alpha[dm] = 1.0

    # 气泡投影（下偏移，柔和）
    proj = rect_mask(x, y, bx0, by0 + 0.028, bx1, by1 + 0.028, b_r)
    rgb[proj] = rgb[proj] * 0.55
    alpha[proj] = np.maximum(alpha[proj], 0.9)

    # 白色气泡 + 尾巴
    bub = rect_mask(x, y, bx0, by0, bx1, by1, b_r) | circle_mask(x, y, tail_cx, tail_cy, tail_r)
    tb = y
    bubc = lerp(white, np.array([0.96, 0.955, 0.98]), np.clip((tb - 0.35) * 1.5, 0, 0.9))
    rgb[bub] = bubc[bub]
    alpha[bub] = 1.0

    # 四角星（渐变紫→粉）
    sm = star_mask(x, y, cx, star_cy, star_r)
    if sm.any():
        tt = np.clip((x[sm] - (cx - star_r)) / (2 * star_r), 0, 1)
        col = lerp(star1, star2, tt * 0.85)[0]
        hot = tt > 0.55
        col[hot] = lerp(star2, star3, (tt[hot] - 0.55) / 0.45)[0]
        rgb[sm] = col
        alpha[sm] = 1.0

    # 光晕辉光增强（星尖光感）
    ring = star_mask(x, y, cx, star_cy, star_r * 1.28, tip=0.44, power=2.0) & ~sm
    rgb[ring] = rgb[ring] + purple * 0.16
    rgb[ring] = np.clip(rgb[ring], 0, 1)

    if mode == 'fg':
        img = np.dstack([rgb * 255, alpha * 255])
    else:
        img = np.dstack([rgb * 255, alpha * 255])

    im = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8), 'RGBA')
    return im.resize((size, size), Image.LANCZOS)

def main():
    root = os.path.dirname(os.path.abspath(__file__))
    web = os.path.join(root, '..', 'web')
    icons = os.path.join(web, 'public', 'icons')
    os.makedirs(icons, exist_ok=True)

    # Web / PWA 图标（完整版）
    for s in [512, 192, 144, 96, 72, 48]:
        draw(s, 'full').save(os.path.join(icons, f'icon-{s}.png'))
        print('web icon', s)

    # Android 图标（完整版 + 自适应前景）
    densities = {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}
    for d, s in densities.items():
        mip = os.path.join(web, 'android', 'app', 'src', 'main', 'res', f'mipmap-{d}')
        draw(s, 'full').save(os.path.join(mip, 'ic_launcher.png'))
        draw(s, 'fg').save(os.path.join(mip, 'ic_launcher_foreground.png'))
        draw(s, 'full').save(os.path.join(mip, 'ic_launcher_round.png'))
        print('android', d)

if __name__ == '__main__':
    main()
