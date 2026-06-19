// Web Speech API 极简封装（中文识别）。不支持时优雅降级。
/* eslint-disable @typescript-eslint/no-explicit-any */

export function speechSupported(): boolean {
  if (typeof window === 'undefined') return false
  return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window
}

export interface Recognizer {
  start: () => void
  stop: () => void
}

export function createRecognizer(opts: {
  onResult: (text: string, isFinal: boolean) => void
  onEnd?: () => void
  onError?: (msg: string) => void
}): Recognizer | null {
  const w = window as any
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition
  if (!Ctor) return null

  const rec = new Ctor()
  rec.lang = 'zh-CN'
  rec.continuous = false
  rec.interimResults = true
  rec.maxAlternatives = 1

  rec.onresult = (e: any) => {
    let interim = ''
    let final = ''
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i]
      if (r.isFinal) final += r[0].transcript
      else interim += r[0].transcript
    }
    if (final) opts.onResult(final, true)
    else if (interim) opts.onResult(interim, false)
  }
  rec.onerror = (e: any) => opts.onError?.(e.error || '识别失败')
  rec.onend = () => opts.onEnd?.()

  return {
    start: () => {
      try { rec.start() } catch { /* 已在运行 */ }
    },
    stop: () => {
      try { rec.stop() } catch { /* noop */ }
    },
  }
}
