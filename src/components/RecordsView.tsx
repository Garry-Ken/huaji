import { useMemo, useState } from 'react'
import type { Expense, InputSource } from '../types'
import { categoryMeta } from '../lib/categories'
import { yuan, timeShort, relativeDay } from '../lib/format'
import { startOfDay } from '../lib/date'
import { HealthRing, MealTag } from './bits'
import { MapPinIcon, MicIcon, ClipboardIcon, SearchIcon, XIcon } from './icons'
import { InputBar } from './InputBar'

const SOURCE_LABEL: Record<InputSource, string> = { text: '手输', voice: '语音', paste: '粘贴', manual: '手动' }

function Row({ e, onClick }: { e: Expense; onClick: () => void }) {
  const m = categoryMeta(e.category)
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#f5f5f7] dark:hover:bg-[#2c2c2e]/50 transition-colors text-left"
    >
      <div className="w-9 h-9 rounded-full flex items-center justify-center text-[17px] shrink-0" style={{ background: m.color + '1f' }}>
        {m.emoji}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-[15px] truncate">{e.title || m.label}</span>
          {e.meal && <MealTag meal={e.meal} />}
          {e.isDebt && <span className={`text-[10px] rounded-full px-1.5 py-0.5 font-medium ${e.type === 'expense' ? 'bg-[#ff9f0a]/15 text-[#ff9f0a]' : 'bg-[#30d158]/15 text-[#30d158]'}`}>{e.type === 'expense' ? '借出' : '借入'}</span>}
        </div>
        {e.health && e.health.tags.length > 0 && (
          <div className="flex items-center gap-1 mt-0.5">
            {e.health.tags.slice(0, 4).map(t => (
              <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#30d158]/10 text-[#30d158]">{t}</span>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2 text-[12px] text-[#86868b] mt-0.5 truncate">
          <span>{timeShort(e.occurredAt)}</span>
          {e.counterparty && <span>👤{e.counterparty}</span>}
          {e.location && <span className="inline-flex items-center gap-0.5"><MapPinIcon size={11} />{e.location}</span>}
          {e.merchant && !e.location && <span>{e.merchant}</span>}
          <span className="inline-flex items-center gap-0.5 opacity-70">
            {e.source === 'voice' && <MicIcon size={11} />}
            {e.source === 'paste' && <ClipboardIcon size={11} />}
            {SOURCE_LABEL[e.source]}
          </span>
        </div>
      </div>
      {e.health && <HealthRing score={e.health.score} size={38} />}
      <div className={`font-semibold text-[16px] tabular-nums shrink-0 ${e.type === 'income' ? 'text-[#30d158]' : ''}`}>
        {e.type === 'income' ? '+' : ''}{yuan(e.amount)}
      </div>
    </button>
  )
}

export function RecordsView({
  expenses,
  onAdd,
  onEdit,
  onLoadSample,
  sampleMode,
  onClearAll,
}: {
  expenses: Expense[]
  onAdd: (raw: string, source: InputSource) => void
  onEdit: (e: Expense) => void
  onLoadSample?: () => void
  sampleMode?: boolean
  onClearAll?: () => void
}) {
  const [limit, setLimit] = useState(40)
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search.trim()) return expenses
    const q = search.trim().toLowerCase()
    return expenses.filter(e =>
      e.title.toLowerCase().includes(q) ||
      e.rawText.toLowerCase().includes(q) ||
      categoryMeta(e.category).label.includes(q) ||
      e.merchant?.toLowerCase().includes(q) ||
      e.location?.toLowerCase().includes(q) ||
      e.note?.toLowerCase().includes(q) ||
      e.items.some(i => i.toLowerCase().includes(q))
    )
  }, [expenses, search])

  const visible = filtered.slice(0, limit)

  const groups = useMemo(() => {
    const map = new Map<number, Expense[]>()
    for (const e of visible) {
      const key = startOfDay(e.occurredAt).getTime()
      const arr = map.get(key) ?? []
      arr.push(e)
      map.set(key, arr)
    }
    return [...map.entries()].sort((a, b) => b[0] - a[0])
  }, [visible])

  return (
    <div className="space-y-4">
      <InputBar onAdd={onAdd} />

      {expenses.length > 5 && (
        <div className="relative">
          <SearchIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#86868b]" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setLimit(40) }}
            placeholder="搜索记录…"
            className="w-full rounded-xl bg-[#f5f5f7] dark:bg-[#2c2c2e] pl-9 pr-8 py-2.5 text-[14px] outline-none"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#86868b]">
              <XIcon size={14} />
            </button>
          )}
        </div>
      )}

      {search && filtered.length === 0 ? (
        <div className="card p-10 text-center text-[#86868b]">
          <div className="text-[32px] mb-2">🔍</div>
          <div>没有找到「{search}」相关的记录</div>
        </div>
      ) : expenses.length === 0 ? (
        <div className="card p-10 text-center text-[#86868b]">
          <div className="text-[40px] mb-2">🧾</div>
          <div>还没有记录，试着在上面记一笔吧</div>
          {onLoadSample && (
            <button onClick={onLoadSample} className="btn-ghost mt-4 text-[13px]">
              先载入示例数据看看效果
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {sampleMode && (
            <div className="rounded-2xl px-4 py-3 flex items-center gap-3 bg-[#ff9f0a]/10 border border-[#ff9f0a]/25">
              <span className="text-[18px] shrink-0">🧪</span>
              <div className="flex-1 min-w-0 text-[13px] text-[#86868b] leading-snug">
                <span className="font-medium text-[#1d1d1f] dark:text-[#f5f5f7]">这是示例数据</span>，仅供预览体验，可随时清空
              </div>
              <button onClick={onClearAll} className="text-[13px] font-semibold text-[#ff375f] shrink-0 px-2 py-1">清空</button>
            </div>
          )}
          {groups.map(([day, items]) => {
            const expenseTotal = items.filter(e => e.type !== 'income').reduce((s, e) => s + e.amount, 0)
            const incomeTotal = items.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0)
            return (
              <div key={day} className="card overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 bg-[#f5f5f7]/70 dark:bg-[#2c2c2e]/40">
                  <span className="text-[13px] font-medium text-[#636366] dark:text-[#aeaeb2]">
                    {relativeDay(day)} · {new Date(day).getMonth() + 1}月{new Date(day).getDate()}日
                  </span>
                  <span className="text-[13px] font-semibold text-[#86868b]">
                    支出 {yuan(expenseTotal)}
                    {incomeTotal > 0 && <span className="text-[#30d158] ml-2">收入 +{yuan(incomeTotal)}</span>}
                  </span>
                </div>
                <div className="divide-y divide-[#00000008] dark:divide-[#ffffff0d]">
                  {items.map((e) => (
                    <Row key={e.id} e={e} onClick={() => onEdit(e)} />
                  ))}
                </div>
              </div>
            )
          })}

          {limit < filtered.length && (
            <button onClick={() => setLimit((l) => l + 60)} className="btn-ghost w-full justify-center">
              加载更多（还有 {filtered.length - limit} 笔）
            </button>
          )}
        </div>
      )}
    </div>
  )
}
