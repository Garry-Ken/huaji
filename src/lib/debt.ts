import type { Expense } from '../types'

export interface DebtSummary {
  person: string
  lent: number      // 我借出总额
  received: number  // 对方还我总额
  borrowed: number  // 我借入总额
  repaid: number    // 我还对方总额
  netBalance: number // >0 对方欠我, <0 我欠对方
  records: Expense[]
}

export function computeDebtSummaries(expenses: Expense[]): DebtSummary[] {
  const debts = expenses.filter(e => e.isDebt && e.counterparty)
  const map = new Map<string, Expense[]>()
  for (const e of debts) {
    const key = e.counterparty!
    const arr = map.get(key) ?? []
    arr.push(e)
    map.set(key, arr)
  }

  const summaries: DebtSummary[] = []
  for (const [person, records] of map) {
    let lent = 0, received = 0, borrowed = 0, repaid = 0
    for (const r of records) {
      if (r.type === 'expense') {
        // 钱从我这里出去 → 我借给对方 或 我还对方
        // 区分：如果之前有 borrowed（我借入过），这里的 expense 可能是还款
        // 简化处理：expense+isDebt = 我借出（对方欠我）
        lent += r.amount
      } else {
        // income+isDebt = 对方还我 或 我借入
        // 区分：用 title/rawText 中是否含"借"来判断
        const raw = r.rawText || r.title || ''
        if (/向.{0,4}借|跟.{0,4}借|找.{0,4}借|问.{0,4}借|借了|借入|借我/.test(raw)) {
          borrowed += r.amount
        } else {
          received += r.amount
        }
      }
    }
    const netBalance = (lent - received) - (borrowed - repaid)
    summaries.push({ person, lent, received, borrowed, repaid, netBalance, records })
  }

  return summaries.sort((a, b) => Math.abs(b.netBalance) - Math.abs(a.netBalance))
}

export function totalDebtNet(summaries: DebtSummary[]): number {
  return summaries.reduce((sum, s) => sum + s.netBalance, 0)
}
