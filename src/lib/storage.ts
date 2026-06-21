import type { AssetAccount, Expense, InputSource, Ledger, ParseResult } from '../types'

const STORAGE_KEY = 'huaji.expenses.v1'
const SEED_FLAG = 'huaji.seeded.v1'

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export function load(): Expense[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return []
    return arr.map((e: Record<string, unknown>) => ({ type: 'expense', ...e }) as Expense)
  } catch {
    return []
  }
}

export function persist(list: Expense[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch {
    /* 存储满或隐私模式：静默降级 */
  }
}

export function hasSeeded(): boolean {
  return localStorage.getItem(SEED_FLAG) === '1'
}

export function markSeeded(): void {
  localStorage.setItem(SEED_FLAG, '1')
}

// 示例数据标记：用户手动“载入示例”后置位，用于在记账页显示“这是示例数据·清空”提示条
const SAMPLE_FLAG = 'huaji.sample.v1'
export function hasSampleFlag(): boolean {
  return localStorage.getItem(SAMPLE_FLAG) === '1'
}
export function setSampleFlag(): void {
  try { localStorage.setItem(SAMPLE_FLAG, '1') } catch { /* ignore */ }
}
export function clearSampleFlag(): void {
  try { localStorage.removeItem(SAMPLE_FLAG) } catch { /* ignore */ }
}

// ---------- 月度预算 ----------
const BUDGET_KEY = 'huaji.budget.v1'
export function loadBudget(): number | null {
  const v = localStorage.getItem(BUDGET_KEY)
  return v ? parseFloat(v) : null
}
export function saveBudget(amount: number | null): void {
  if (amount == null) localStorage.removeItem(BUDGET_KEY)
  else localStorage.setItem(BUDGET_KEY, String(amount))
}

// ---------- JSON 备份/恢复 ----------
export function exportToJSON(expenses: Expense[]): void {
  const data = { version: 1, app: '花迹', exportedAt: new Date().toISOString(), count: expenses.length, records: expenses }
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `花迹备份_${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export function importFromJSON(file: File): Promise<Expense[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string)
        const records = parsed.records ?? parsed
        if (!Array.isArray(records)) throw new Error('无效的备份文件')
        const validated = records.map((r: Record<string, unknown>) => ({
          type: 'expense',
          ...r,
          id: (r.id as string) || uid(),
          amount: Number(r.amount) || 0,
          category: r.category || 'other',
          title: String(r.title ?? ''),
          items: Array.isArray(r.items) ? r.items : [],
          occurredAt: Number(r.occurredAt) || Date.now(),
          createdAt: Number(r.createdAt) || Date.now(),
          source: r.source || 'manual',
          rawText: String(r.rawText ?? ''),
        })) as Expense[]
        resolve(validated)
      } catch (e) {
        reject(e instanceof Error ? e : new Error('解析备份文件失败'))
      }
    }
    reader.onerror = () => reject(new Error('读取文件失败'))
    reader.readAsText(file)
  })
}

/** 由解析草稿生成正式记录 */
export function makeExpense(parse: ParseResult, rawText: string, source: InputSource, ledgerId?: string): Expense {
  const now = Date.now()
  return {
    id: uid(),
    type: parse.type ?? 'expense',
    amount: parse.amount ?? 0,
    category: parse.category,
    title: parse.title || rawText.slice(0, 12),
    items: parse.items,
    ...(parse.quantity ? { quantity: parse.quantity } : {}),
    merchant: parse.merchant,
    location: parse.location,
    occurredAt: parse.occurredAt || now,
    createdAt: now,
    updatedAt: now,
    source,
    rawText,
    note: rawText,
    meal: parse.meal,
    health: parse.health,
    ...(ledgerId && ledgerId !== 'default' ? { ledgerId } : {}),
    ...(parse.counterparty ? { counterparty: parse.counterparty, isDebt: true } : {}),
  }
}

export function sortByTime(list: Expense[]): Expense[] {
  return [...list].sort((a, b) => b.occurredAt - a.occurredAt)
}

// ---------- 账本 ----------
const LEDGER_KEY = 'huaji.ledgers.v1'
export const DEFAULT_LEDGER: Ledger = { id: 'default', name: '日常', emoji: '📒', createdAt: 0 }

export function loadLedgers(): Ledger[] {
  try {
    const raw = localStorage.getItem(LEDGER_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr : []
  } catch { return [] }
}

export function persistLedgers(list: Ledger[]): void {
  try { localStorage.setItem(LEDGER_KEY, JSON.stringify(list)) } catch { /* ignore */ }
}

// ---------- 资产账户 ----------
const ACCOUNT_KEY = 'huaji.accounts.v1'

export function loadAccounts(): AssetAccount[] {
  try {
    const raw = localStorage.getItem(ACCOUNT_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr : []
  } catch { return [] }
}

export function persistAccounts(list: AssetAccount[]): void {
  try { localStorage.setItem(ACCOUNT_KEY, JSON.stringify(list)) } catch { /* ignore */ }
}

// ---------- 软删除（回收站） ----------
const DELETED_KEY = 'huaji.deleted.v1'
const DELETED_TTL = 30 * 86400000 // 30 天自动清理

export function loadDeleted(): Expense[] {
  try {
    const raw = localStorage.getItem(DELETED_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return []
    const cutoff = Date.now() - DELETED_TTL
    return arr.filter((e: Record<string, unknown>) => (e.deletedAt as number) > cutoff) as Expense[]
  } catch { return [] }
}

export function persistDeleted(list: Expense[]): void {
  try { localStorage.setItem(DELETED_KEY, JSON.stringify(list)) } catch { /* ignore */ }
}

export function softDelete(ids: Set<string>, allExpenses: Expense[]): { remaining: Expense[]; deleted: Expense[] } {
  const now = Date.now()
  const deleted: Expense[] = []
  const remaining: Expense[] = []
  for (const e of allExpenses) {
    if (ids.has(e.id)) deleted.push({ ...e, deletedAt: now } as Expense & { deletedAt: number })
    else remaining.push(e)
  }
  const prev = loadDeleted()
  persistDeleted([...deleted, ...prev])
  return { remaining, deleted }
}
