// 应用内更新检测：优先同源自托管更新信息，其次查询 GitHub Releases
// 版本升级后请同步更新 APP_VERSION（与 package.json / android build.gradle 保持一致）

export const APP_VERSION = '1.5.0'
export const GITHUB_REPO = '19923421354/xingyu'

export function compareVersion(a, b) {
  const pa = String(a || '').split('.').map((n) => parseInt(n, 10) || 0)
  const pb = String(b || '').split('.').map((n) => parseInt(n, 10) || 0)
  for (let i = 0; i < 3; i++) {
    const x = pa[i] || 0
    const y = pb[i] || 0
    if (x !== y) return x > y ? 1 : -1
  }
  return 0
}

function normalize(d) {
  const latest = String(d.version || '').replace(/^v/i, '')
  return {
    latest,
    hasUpdate: compareVersion(latest, APP_VERSION) > 0,
    notes: d.notes || d.body || '',
    name: d.name || '',
    apkUrl: d.apkUrl || '',
    apkSize: d.apkSize || 0,
    publishedAt: d.publishedAt || '',
  }
}

export async function checkUpdate() {
  // 1) 同源自托管优先（局域网 / 自部署可配置）
  try {
    const res = await fetch('/api/update.json', { cache: 'no-store' })
    if (res.ok) {
      const d = await res.json()
      if (d && d.version) return normalize(d)
    }
  } catch (e) {
    // 继续尝试 GitHub
  }

  // 2) GitHub Releases latest
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`)
    if (res.ok) {
      const r = await res.json()
      const asset = (r.assets || []).find((a) => a.name && a.name.toLowerCase().endsWith('.apk'))
      return normalize({
        version: (r.tag_name || '').replace(/^v/i, ''),
        notes: r.body || '',
        name: r.name || r.tag_name || '',
        apkUrl: asset ? asset.browser_download_url || '' : '',
        apkSize: asset ? asset.size || 0 : 0,
        publishedAt: r.published_at || '',
      })
    }
  } catch (e) {
    // 网络不可用
  }
  return null
}

// 下载并安装新版本：原生端走系统下载+安装，Web 端直接下载 APK
export async function downloadAndInstall(apkUrl) {
  if (!apkUrl) throw new Error('暂无可用的下载地址')
  const bridge = window.XingyuUpdater
  if (bridge && typeof bridge.downloadAndInstall === 'function') {
    return bridge.downloadAndInstall(apkUrl)
  }
  const a = document.createElement('a')
  a.href = apkUrl
  a.download = 'xingyu-latest.apk'
  a.rel = 'noopener'
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  a.remove()
  return { web: true }
}
