import { useMemo, useState } from 'react'
import type { Expense, InputSource } from '../types'
import { categoryMeta } from '../lib/categories'
import { yuan, timeShort, relativeDay } from '../lib/format'
import { startOfDay } from '../lib/date'
import { HealthRing, MealTag } from './bits'
import { MapPinIcon, MicIcon, ClipboardIcon } from './icons'
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
        </div>
        <div className="flex items-center gap-2 text-[12px] text-[#86868b] mt-0.5 truncate">
          <span>{timeShort(e.occurredAt)}</span>
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
      <div className="font-semibold text-[16px] tabular-nums shrink-0">{yuan(e.amount)}</div>
    </button>
  )
}

export function RecordsView({
  expenses,
  onAdd,
  onEdit,
}: {
  expenses: Expense[]
  onAdd: (raw: string, source: InputSource) => void
  onEdit: (e: Expense) => void
}) {
  const [limit, setLimit] = useState(40)
  const visible = expenses.slice(0, limit)

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

      {expenses.length === 0 ? (
        <div className="card p-10 text-center text-[#86868b]">
          <div className="text-[40px] mb-2">🧾</div>
          还没有记录，试着在上面记一笔吧
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map(([day, items]) => {
            const total = items.reduce((s, e) => s + e.amount, 0)
            return (
              <div key={day} className="card overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 bg-[#f5f5f7]/70 dark:bg-[#2c2c2e]/40">
                  <span className="text-[13px] font-medium text-[#636366] dark:text-[#aeaeb2]">
                    {relativeDay(day)} · {new Date(day).getMonth() + 1}月{new Date(day).getDate()}日
                  </span>
                  <span className="text-[13px] font-semibold text-[#86868b]">支出 {yuan(total)}</span>
                </div>
                <div className="divide-y divide-[#00000008] dark:divide-[#ffffff0d]">
                  {items.map((e) => (
                    <Row key={e.id} e={e} onClick={() => onEdit(e)} />
                  ))}
                </div>
              </div>
            )
          })}

          {limit < expenses.length && (
            <button onClick={() => setLimit((l) => l + 60)} className="btn-ghost w-full justify-center">
              加载更多（还有 {expenses.length - limit} 笔）
            </button>
          )}
        </div>
      )}
    </div>
  )
}
