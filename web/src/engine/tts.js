// 语音合成：使用系统自带的 Web Speech API，完全免费、离线可用。

let enabled = true
let rate = 1
let pitch = 1
let lang = 'zh-CN'

export function initTTS(settings) {
  enabled = settings.tts ? settings.tts.enabled !== false : true
  rate = (settings.tts && settings.tts.rate) || 1
  pitch = (settings.tts && settings.tts.pitch) || 1
  lang = settings.lang === 'en' ? 'en-US' : 'zh-CN'
}

export function ttsSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

export function ttsEnabled() {
  return enabled && ttsSupported()
}

let currentUtterance = null

export function speak(text, onEnd) {
  if (!ttsSupported()) return
  stopSpeak()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = lang
  u.rate = rate
  u.pitch = pitch
  const voices = window.speechSynthesis.getVoices()
  const zhVoice = voices.find((v) => v.lang && v.lang.toLowerCase().startsWith('zh'))
  if (zhVoice) u.voice = zhVoice
  currentUtterance = u
  u.onend = () => {
    currentUtterance = null
    if (onEnd) onEnd()
  }
  u.onerror = () => {
    currentUtterance = null
    if (onEnd) onEnd()
  }
  window.speechSynthesis.speak(u)
}

export function stopSpeak() {
  if (!ttsSupported()) return
  window.speechSynthesis.cancel()
  currentUtterance = null
}

export function isSpeaking() {
  return !!currentUtterance
}
