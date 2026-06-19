import type { Expense, InputSource, ParseResult } from '../types'

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
    return Array.isArray(arr) ? (arr as Expense[]) : []
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

/** 由解析草稿生成正式记录 */
export function makeExpense(parse: ParseResult, rawText: string, source: InputSource): Expense {
  const now = Date.now()
  return {
    id: uid(),
    amount: parse.amount ?? 0,
    category: parse.category,
    title: parse.title || rawText.slice(0, 12),
    items: parse.items,
    merchant: parse.merchant,
    location: parse.location,
    occurredAt: parse.occurredAt || now,
    createdAt: now,
    source,
    rawText,
    meal: parse.meal,
    health: parse.health,
  }
}

export function sortByTime(list: Expense[]): Expense[] {
  return [...list].sort((a, b) => b.occurredAt - a.occurredAt)
}
