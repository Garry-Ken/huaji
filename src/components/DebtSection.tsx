import { useMemo, useState } from 'react'
import type { Expense } from '../types'
import { computeDebtSummaries, totalDebtNet } from '../lib/debt'
import { yuan, signedYuan } from '../lib/format'

interface Props {
  expenses: Expense[]
  onSettle: (person: string, amount: number) => void
}

export function DebtSection({ expenses, onSettle }: Props) {
  const summaries = useMemo(() => computeDebtSummaries(expenses), [expenses])
  const net = useMemo(() => totalDebtNet(summaries), [summaries])
  const [expanded, setExpanded] = useState<string | null>(null)

  if (summaries.length === 0) return null

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[17px] font-semibold">借贷概览</h3>
        <span className={`text-[14px] font-semibold ${net > 0 ? 'text-[#30d158]' : net < 0 ? 'text-[#ff3b30]' : 'text-[#86868b]'}`}>
          {net > 0 ? `净应收 +${yuan(net).slice(1)}` : net < 0 ? `净应付 ${yuan(Math.abs(net))}` : '已清账'}
        </span>
      </div>

      <div className="card space-y-0 divide-y divide-[#00000008] dark:divide-[#ffffff08]">
        {summaries.map(s => {
          const isExpanded = expanded === s.person
          return (
            <div key={s.person}>
              <button className="w-full flex items-center gap-3 px-4 py-3.5 text-left" onClick={() => setExpanded(isExpanded ? null : s.person)}>
                <span className="w-8 h-8 rounded-full bg-[#f5f5f7] dark:bg-[#2c2c2e] flex items-center justify-center text-[15px]">👤</span>
                <span className="flex-1 text-[15px] font-medium">{s.person}</span>
                <span className={`text-[15px] font-semibold tabular-nums ${s.netBalance > 0 ? 'text-[#30d158]' : s.netBalance < 0 ? 'text-[#ff3b30]' : 'text-[#86868b]'}`}>
                  {s.netBalance > 0 ? `应收 +${yuan(s.netBalance).slice(1)}` : s.netBalance < 0 ? `应付 ${yuan(Math.abs(s.netBalance))}` : '已清'}
                </span>
                <svg className={`w-4 h-4 text-[#86868b] transition-transform ${isExpanded ? 'rotate-180' : ''}`} viewBox="0 0 16 16" fill="none">
                  <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>

              {isExpanded && (
                <div className="px-4 pb-4">
                  <div className="flex gap-3 text-[12px] text-[#86868b] mb-3 px-1">
                    {s.lent > 0 && <span>借出 {yuan(s.lent)}</span>}
                    {s.received > 0 && <span>已收 {yuan(s.received)}</span>}
                    {s.borrowed > 0 && <span>借入 {yuan(s.borrowed)}</span>}
                    {s.repaid > 0 && <span>已还 {yuan(s.repaid)}</span>}
                  </div>

                  <div className="space-y-1.5 mb-3">
                    {s.records.slice(0, 10).map(r => (
                      <div key={r.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#f5f5f7] dark:bg-[#2c2c2e] text-[13px]">
                        <span className={`font-medium ${r.type === 'income' ? 'text-[#30d158]' : 'text-[#ff3b30]'}`}>
                          {r.type === 'income' ? '收' : '出'}
                        </span>
                        <span className="flex-1 truncate text-[#86868b]">{r.title || r.rawText}</span>
                        <span className="font-semibold tabular-nums">{signedYuan(r.amount, r.type)}</span>
                      </div>
                    ))}
                  </div>

                  {s.netBalance !== 0 && (
                    <button onClick={() => onSettle(s.person, Math.abs(s.netBalance))}
                      className="w-full py-2.5 rounded-xl bg-[#0a84ff]/10 text-[#0a84ff] text-[14px] font-medium hover:bg-[#0a84ff]/15 transition-colors">
                      清账 · {s.netBalance > 0 ? `确认收到 ${yuan(Math.abs(s.netBalance))}` : `确认已还 ${yuan(Math.abs(s.netBalance))}`}
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
