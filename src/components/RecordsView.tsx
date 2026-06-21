import { useCallback, useMemo, useRef, useState } from 'react'
import type { Expense, InputSource } from '../types'
import { categoryMeta } from '../lib/categories'
import { yuan, timeShort, relativeDay } from '../lib/format'
import { startOfDay } from '../lib/date'
import { HealthRing, MealTag } from './bits'
import { MapPinIcon, MicIcon, ClipboardIcon, SearchIcon, XIcon, TrashIcon, CheckIcon } from './icons'
import { InputBar } from './InputBar'

const SOURCE_LABEL: Record<InputSource, string> = { text: '手输', voice: '语音', paste: '粘贴', manual: '手动' }

function Row({ e, onClick, selecting, selected, onToggle, onLongPress }: {
  e: Expense; onClick: () => void
  selecting: boolean; selected: boolean
  onToggle: () => void; onLongPress: () => void
}) {
  const m = categoryMeta(e.category)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const movedRef = useRef(false)

  const startPress = useCallback(() => {
    movedRef.current = false
    timerRef.current = setTimeout(() => { timerRef.current = null; onLongPress() }, 400)
  }, [onLongPress])
  const cancelPress = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
  }, [])
  const moved = useCallback(() => { movedRef.current = true; cancelPress() }, [cancelPress])

  const handleClick = () => {
    if (selecting) onToggle()
    else onClick()
  }

  return (
    <button
      onClick={handleClick}
      onPointerDown={selecting ? undefined : startPress}
      onPointerUp={cancelPress}
      onPointerLeave={cancelPress}
      onPointerMove={moved}
      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#f5f5f7] dark:hover:bg-[#2c2c2e]/50 transition-colors text-left select-none"
    >
      {selecting ? (
        <div className={`w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${selected ? 'border-[#0a84ff] bg-[#0a84ff]' : 'border-[#c7c7cc] dark:border-[#48484a]'}`}>
          {selected && <CheckIcon size={13} className="text-white" />}
        </div>
      ) : (
        <div className="w-9 h-9 rounded-full flex items-center justify-center text-[17px] shrink-0" style={{ background: m.color + '1f' }}>
          {m.emoji}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {e.category === 'food' && e.items.length > 1 ? (
            <span className="font-medium text-[15px] truncate">今日美食</span>
          ) : (
            <span className="font-medium text-[15px] truncate">{e.title || m.label}</span>
          )}
          {e.quantity && <span className="text-[12px] text-[#86868b] shrink-0">{e.quantity}</span>}
          {e.meal && <MealTag meal={e.meal} />}
          {e.isDebt && <span className={`text-[10px] rounded-full px-1.5 py-0.5 font-medium ${e.type === 'expense' ? 'bg-[#ff9f0a]/15 text-[#ff9f0a]' : 'bg-[#30d158]/15 text-[#30d158]'}`}>{e.type === 'expense' ? '借出' : '借入'}</span>}
        </div>
        {e.category === 'food' && e.items.length > 1 && (
          <div className="flex flex-wrap items-center gap-1 mt-0.5">
            {e.items.slice(0, 8).map((item, i) => (
              <span key={i} className="text-[11px] px-1.5 py-0.5 rounded-md bg-[#ff9f0a]/10 text-[#ff9f0a] dark:text-[#ffd60a]">{item}</span>
            ))}
            {e.items.length > 8 && <span className="text-[11px] text-[#86868b]">+{e.items.length - 8}</span>}
          </div>
        )}
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
      {!selecting && e.health && <HealthRing score={e.health.score} size={38} />}
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
  onBatchDelete,
  onLoadSample,
  sampleMode,
  onClearAll,
}: {
  expenses: Expense[]
  onAdd: (raw: string, source: InputSource) => void
  onEdit: (e: Expense) => void
  onBatchDelete?: (ids: string[]) => void
  onLoadSample?: () => void
  sampleMode?: boolean
  onClearAll?: () => void
}) {
  const [limit, setLimit] = useState(40)
  const [search, setSearch] = useState('')
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const exitSelect = useCallback(() => { setSelecting(false); setSelected(new Set()) }, [])

  const toggleOne = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }, [])

  const enterSelect = useCallback((id: string) => {
    setSelecting(true)
    setSelected(new Set([id]))
  }, [])

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

  const toggleGroup = useCallback((items: Expense[]) => {
    setSelected(prev => {
      const next = new Set(prev)
      const allIn = items.every(e => next.has(e.id))
      if (allIn) items.forEach(e => next.delete(e.id))
      else items.forEach(e => next.add(e.id))
      return next
    })
  }, [])

  const selectAll = useCallback(() => {
    setSelected(new Set(filtered.map(e => e.id)))
  }, [filtered])

  const confirmDelete = () => {
    if (selected.size === 0) return
    if (!window.confirm(`确认删除 ${selected.size} 条记录？\n删除后可在"我的"页面从云端恢复`)) return
    onBatchDelete?.([...selected])
    exitSelect()
  }

  return (
    <div className="space-y-4">
      {/* 选择模式工具栏 */}
      {selecting && (
        <div className="card flex items-center gap-2 px-4 py-3 sticky top-14 z-20">
          <button onClick={exitSelect} className="btn-ghost !px-2.5 text-[13px]">取消</button>
          <button onClick={selectAll} className="btn-ghost !px-2.5 text-[13px]">全选</button>
          <span className="flex-1 text-center text-[13px] text-[#86868b]">已选 {selected.size} 项</span>
          <button onClick={confirmDelete} disabled={selected.size === 0} className="btn-ghost !px-3 text-[13px] !text-[#ff3b30] font-semibold disabled:opacity-40">
            <TrashIcon size={15} />删除
          </button>
        </div>
      )}

      {!selecting && <InputBar onAdd={onAdd} />}

      {expenses.length > 5 && (
        <div className="relative flex items-center gap-2">
          <div className="relative flex-1">
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
          {!selecting && (
            <button onClick={() => setSelecting(true)} className="text-[13px] text-[#0a84ff] font-medium shrink-0 px-1">
              选择
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
            const groupAllSelected = selecting && items.every(e => selected.has(e.id))
            return (
              <div key={day} className="card overflow-hidden">
                <div
                  className={`flex items-center justify-between px-4 py-2.5 bg-[#f5f5f7]/70 dark:bg-[#2c2c2e]/40 ${selecting ? 'cursor-pointer' : ''}`}
                  onClick={selecting ? () => toggleGroup(items) : undefined}
                >
                  <div className="flex items-center gap-2">
                    {selecting && (
                      <div className={`w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${groupAllSelected ? 'border-[#0a84ff] bg-[#0a84ff]' : 'border-[#c7c7cc] dark:border-[#48484a]'}`}>
                        {groupAllSelected && <CheckIcon size={11} className="text-white" />}
                      </div>
                    )}
                    <span className="text-[13px] font-medium text-[#636366] dark:text-[#aeaeb2]">
                      {relativeDay(day)} · {new Date(day).getMonth() + 1}月{new Date(day).getDate()}日
                    </span>
                  </div>
                  <span className="text-[13px] font-semibold text-[#86868b]">
                    支出 {yuan(expenseTotal)}
                    {incomeTotal > 0 && <span className="text-[#30d158] ml-2">收入 +{yuan(incomeTotal)}</span>}
                  </span>
                </div>
                <div className="divide-y divide-[#00000008] dark:divide-[#ffffff0d]">
                  {items.map((e) => (
                    <Row
                      key={e.id} e={e}
                      onClick={() => onEdit(e)}
                      selecting={selecting}
                      selected={selected.has(e.id)}
                      onToggle={() => toggleOne(e.id)}
                      onLongPress={() => enterSelect(e.id)}
                    />
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
