import { useEffect, useMemo, useState } from 'react'
import type { Expense, PeriodKind } from '../types'
import { useEntitlement, PRO_PERIODS } from '../lib/entitlement'
import { categoryMeta } from '../lib/categories'
import { periodRange, periodLabel, shift, subBuckets, DAY } from '../lib/date'
import { yuan } from '../lib/format'
import { aggregateHealth } from '../lib/health'
import { Donut, Bars, type Slice } from './charts'
import { StatTile, HealthRing } from './bits'
import { ChevronLeft, ChevronRight, SparkIcon, LockIcon } from './icons'

const KINDS: { id: PeriodKind; label: string }[] = [
  { id: 'day', label: '日' },
  { id: 'week', label: '周' },
  { id: 'month', label: '月' },
  { id: 'quarter', label: '季度' },
  { id: 'half', label: '半年' },
  { id: 'year', label: '年度' },
]

export function Dashboard({ expenses, onGotoHealth }: { expenses: Expense[]; onGotoHealth?: () => void }) {
  const [kind, setKind] = useState<PeriodKind>('month')
  const [anchor, setAnchor] = useState<number>(Date.now())
  const { isPro, openPaywall } = useEntitlement()

  // 降级后若停留在 Pro 周期，回退到「月」
  useEffect(() => {
    if (!isPro && PRO_PERIODS.has(kind)) setKind('month')
  }, [isPro, kind])

  const pickKind = (k: PeriodKind) => {
    if (!isPro && PRO_PERIODS.has(k)) { openPaywall(`「${KINDS.find((x) => x.id === k)?.label}」分析是 Pro 功能`); return }
    setKind(k)
    setAnchor(Date.now())
  }

  const view = useMemo(() => {
    const { start, end } = periodRange(kind, anchor)
    const inRange = expenses.filter((e) => e.occurredAt >= start && e.occurredAt < end)
    const total = inRange.reduce((s, e) => s + e.amount, 0)

    const prev = periodRange(kind, shift(kind, anchor, -1).getTime())
    const prevTotal = expenses
      .filter((e) => e.occurredAt >= prev.start && e.occurredAt < prev.end)
      .reduce((s, e) => s + e.amount, 0)

    // 分类聚合
    const byCat = new Map<string, number>()
    for (const e of inRange) byCat.set(e.category, (byCat.get(e.category) ?? 0) + e.amount)
    const cats = [...byCat.entries()]
      .map(([id, value]) => ({ id, value, meta: categoryMeta(id as never) }))
      .sort((a, b) => b.value - a.value)

    // 子桶（柱状）
    const buckets = subBuckets(kind, anchor)
    const now = Date.now()
    const bars = buckets.map((b) => ({
      label: b.label,
      value: inRange.filter((e) => e.occurredAt >= b.start && e.occurredAt < b.end).reduce((s, e) => s + e.amount, 0),
    }))
    const highlightIndex = buckets.findIndex((b) => now >= b.start && now < b.end)

    // 日均
    const elapsedEnd = Math.min(now, end)
    const days = Math.max(1, Math.ceil((elapsedEnd - start) / DAY))
    const perDay = total / days

    // 饮食健康
    const health = aggregateHealth(inRange.filter((e) => e.category === 'food'))

    const atPresent = end > now
    return { start, end, inRange, total, prevTotal, cats, bars, highlightIndex, perDay, count: inRange.length, health, atPresent }
  }, [expenses, kind, anchor])

  const slices: Slice[] = view.cats.map((c) => ({ label: c.meta.label, value: c.value, color: c.meta.color }))
  const delta = view.prevTotal > 0 ? ((view.total - view.prevTotal) / view.prevTotal) * 100 : null
  const barUnit = kind === 'day' ? '时段' : kind === 'week' || kind === 'month' ? '每日' : '每月'

  return (
    <div className="space-y-4">
      {/* 周期切换 */}
      <div className="seg w-full overflow-x-auto no-scrollbar">
        {KINDS.map((k) => {
          const locked = !isPro && PRO_PERIODS.has(k.id)
          return (
            <button
              key={k.id}
              onClick={() => pickKind(k.id)}
              className={`seg-item flex-1 inline-flex items-center justify-center gap-0.5 ${kind === k.id ? 'seg-item-active' : ''}`}
            >
              {k.label}
              {locked && <LockIcon size={10} className="opacity-50" />}
            </button>
          )
        })}
      </div>

      {/* 周期导航 */}
      <div className="flex items-center justify-between">
        <button onClick={() => setAnchor(shift(kind, anchor, -1).getTime())} className="btn-ghost !p-2 !rounded-full"><ChevronLeft size={18} /></button>
        <div className="text-center">
          <div className="text-[16px] font-semibold">{periodLabel(kind, anchor)}</div>
          {!view.atPresent && (
            <button onClick={() => setAnchor(Date.now())} className="text-[12px] text-[#0a84ff]">回到当前</button>
          )}
        </div>
        <button
          onClick={() => setAnchor(shift(kind, anchor, 1).getTime())}
          disabled={view.atPresent}
          className="btn-ghost !p-2 !rounded-full disabled:opacity-30"
        ><ChevronRight size={18} /></button>
      </div>

      {/* 概览 + 环形图 */}
      <div className="card p-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="text-[13px] text-[#86868b]">总支出</div>
            <div className="text-[34px] font-bold tracking-tight leading-tight">{yuan(view.total)}</div>
            {delta != null && (
              <div className={`text-[13px] mt-0.5 ${delta > 0 ? 'text-[#ff3b30]' : 'text-[#30d158]'}`}>
                {delta > 0 ? '↑' : '↓'} {Math.abs(delta).toFixed(0)}% 较上一{KINDS.find((k) => k.id === kind)?.label}
              </div>
            )}
          </div>
          <Donut
            data={slices}
            size={150}
            center={
              <div>
                <div className="text-[11px] text-[#86868b]">{view.count} 笔</div>
                <div className="text-[13px] font-semibold">{view.cats[0]?.meta.label ?? '—'}</div>
                <div className="text-[11px] text-[#86868b]">占比最高</div>
              </div>
            }
          />
        </div>

        <div className="grid grid-cols-3 gap-2.5 mt-4">
          <StatTile label="日均" value={yuan(view.perDay)} />
          <StatTile label="笔数" value={view.count} />
          <StatTile label="单笔均" value={yuan(view.count ? view.total / view.count : 0)} />
        </div>
      </div>

      {/* 趋势柱状 */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[15px] font-semibold">支出趋势</h3>
          <span className="text-[12px] text-[#86868b]">{barUnit}</span>
        </div>
        <Bars data={view.bars} highlightIndex={view.highlightIndex} formatValue={(v) => yuan(v)} />
      </div>

      {/* 分类明细 */}
      <div className="card p-5">
        <h3 className="text-[15px] font-semibold mb-3">分类明细</h3>
        {view.cats.length === 0 ? (
          <div className="text-[14px] text-[#86868b] py-6 text-center">本周期暂无支出</div>
        ) : (
          <div className="space-y-2.5">
            {view.cats.map((c) => {
              const pct = view.total > 0 ? (c.value / view.total) * 100 : 0
              return (
                <div key={c.id} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-[15px] shrink-0" style={{ background: c.meta.color + '1f' }}>{c.meta.emoji}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="font-medium">{c.meta.label}</span>
                      <span className="tabular-nums">{yuan(c.value)} <span className="text-[#86868b]">· {pct.toFixed(0)}%</span></span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[#00000008] dark:bg-[#ffffff12] mt-1 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: c.meta.color }} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 饮食健康概览（teaser） */}
      {view.health.mealCount > 0 && (
        <button onClick={onGotoHealth} className="card p-5 w-full text-left flex items-center gap-4 hover:shadow-apple-lg transition-shadow">
          <HealthRing score={view.health.avgScore} size={56} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-[15px] font-semibold"><SparkIcon size={16} className="text-[#0a84ff]" />饮食健康评分</div>
            <div className="text-[12px] text-[#86868b] mt-0.5 truncate">
              本周期 {view.health.mealCount} 餐 · 估算 {Math.round(view.health.kcalTotal / 1000)}k kcal · 点击查看分析与建议
            </div>
          </div>
          <ChevronRight size={18} className="text-[#86868b]" />
        </button>
      )}
    </div>
  )
}
