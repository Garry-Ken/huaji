const TOKEN_KEY = 'huaji.aiTokens.v1'
const MONTHLY_LIMIT = 100_000_000

interface TokenStore {
  month: string
  used: number
}

function currentMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function load(): TokenStore {
  try {
    const raw = localStorage.getItem(TOKEN_KEY)
    if (!raw) return { month: currentMonth(), used: 0 }
    const s = JSON.parse(raw) as TokenStore
    if (s.month !== currentMonth()) return { month: currentMonth(), used: 0 }
    return s
  } catch {
    return { month: currentMonth(), used: 0 }
  }
}

function save(s: TokenStore): void {
  try { localStorage.setItem(TOKEN_KEY, JSON.stringify(s)) } catch { /* ignore */ }
}

export function getTokenUsage(): { used: number; limit: number; month: string; percent: number } {
  const s = load()
  return { used: s.used, limit: MONTHLY_LIMIT, month: s.month, percent: Math.min(100, (s.used / MONTHLY_LIMIT) * 100) }
}

export function canChat(): boolean {
  return load().used < MONTHLY_LIMIT
}

export function trackTokens(count: number): void {
  const s = load()
  s.used += count
  save(s)
}
