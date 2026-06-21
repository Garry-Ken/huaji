import type { Tier } from './entitlement'

const QUOTA_KEY = 'huaji.quota.v1'

type Feature = 'recover' | 'export' | 'import'

interface QuotaStore {
  month: string
  recover: number
  export: number
  import: number
}

// 导入导出按档位限量；云端恢复已免费（recover 不限）
const LIMITS: Record<'export' | 'import', Record<Tier, number>> = {
  export:  { pro: 30, ultra: Infinity },
  import:  { pro: 30, ultra: Infinity },
}

function currentMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function load(): QuotaStore {
  try {
    const raw = localStorage.getItem(QUOTA_KEY)
    if (!raw) return { month: currentMonth(), recover: 0, export: 0, import: 0 }
    const s = JSON.parse(raw) as QuotaStore
    if (s.month !== currentMonth()) return { month: currentMonth(), recover: 0, export: 0, import: 0 }
    return s
  } catch {
    return { month: currentMonth(), recover: 0, export: 0, import: 0 }
  }
}

function save(s: QuotaStore): void {
  try { localStorage.setItem(QUOTA_KEY, JSON.stringify(s)) } catch { /* ignore */ }
}

export function checkQuota(feature: Feature, tier?: Tier): { allowed: boolean; used: number; limit: number } {
  if (feature === 'recover') return { allowed: true, used: 0, limit: Infinity } // 云端恢复免费
  if (!tier) return { allowed: false, used: 0, limit: 0 }
  const s = load()
  const limit = LIMITS[feature][tier]
  const used = s[feature]
  return { allowed: used < limit, used, limit }
}

export function useQuota(feature: Feature): void {
  const s = load()
  s[feature]++
  save(s)
}
