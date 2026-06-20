import { useEffect, useMemo, useState } from 'react'
import type { Expense, PeriodKind } from '../types'
import { useEntitlement, PRO_PERIODS } from '../lib/entitlement'
import { periodRange, periodLabel, shift, subBuckets } from '../lib/date'
import { aggregateHealth, LEVEL_META, levelOf } from '../lib/health'
import { Trend } from './charts'
import { HealthRing, StatTile } from './bits'
import { ChevronLeft, ChevronRight, SparkIcon, HealthIcon, LockIcon } from './icons'

const KINDS: { id: PeriodKind; label: string }[] = [
  { id: 'week', label: '周' },
  { id: 'month', label: '月' },
  { id: 'quarter', label: '季度' },
  { id: 'half', label: '半年' },
  { id: 'year', label: '年度' },
]

export function HealthPanel({ expenses, onOpenAiChat }: { expenses: Expense[]; onOpenAiChat?: () => void }) {
  const [kind, setKind] = useState<PeriodKind>('month')
  const [anchor, setAnchor] = useState<number>(Date.now())
  const { isPro, openPaywall } = useEntitlement()

  useEffect(() => {
    if (!isPro && PRO_PERIODS.has(kind)) setKind('month')
  }, [isPro, kind])

  const pickKind = (k: PeriodKind) => {
    if (!isPro && PRO_PERIODS.has(k)) { openPaywall(`「${KINDS.find((x) => x.id === k)?.label}」健康分析是 Pro 功能`); return }
    setKind(k)
    setAnchor(Date.now())
  }

  const view = useMemo(() => {
    const { start, end } = periodRange(kind, anchor)
    const food = expenses.filter((e) => e.category === 'food' && e.health && e.occurredAt >= start && e.occurredAt < end)
    const agg = aggregateHealth(food)

    // 评分趋势（按子桶取均分，仅保留有餐次的桶）
    const buckets = subBuckets(kind, anchor)
    const trend = buckets
      .map((b) => {
        const meals = food.filter((e) => e.occurredAt >= b.start && e.occurredAt < b.end)
        const avg = meals.length ? meals.reduce((s, e) => s + e.health!.score, 0) / meals.length : null
        return { label: b.label, value: avg }
      })
      .filter((p): p is { label: string; value: number } => p.value != null)

    // 等级分布
    const dist = { great: 0, good: 0, fair: 0, poor: 0 }
    for (const e of food) dist[levelOf(e.health!.score)]++

    const atPresent = end > Date.now()
    return { agg, trend, dist, mealCount: food.length, atPresent }
  }, [expenses, kind, anchor])

  const { agg } = view

  return (
    <div className="space-y-4">
      <div className="seg w-full overflow-x-auto no-scrollbar">
        {KINDS.map((k) => {
          const locked = !isPro && PRO_PERIODS.has(k.id)
          return (
            <button key={k.id} onClick={() => pickKind(k.id)} className={`seg-item flex-1 inline-flex items-center justify-center gap-0.5 ${kind === k.id ? 'seg-item-active' : ''}`}>
              {k.label}
              {locked && <LockIcon size={10} className="opacity-50" />}
            </button>
          )
        })}
      </div>

      <div className="flex items-center justify-between">
        <button onClick={() => setAnchor(shift(kind, anchor, -1).getTime())} className="btn-ghost !p-2 !rounded-full"><ChevronLeft size={18} /></button>
        <div className="text-center">
          <div className="text-[16px] font-semibold">{periodLabel(kind, anchor)}</div>
          {!view.atPresent && <button onClick={() => setAnchor(Date.now())} className="text-[12px] text-[#0a84ff]">回到当前</button>}
        </div>
        <button onClick={() => setAnchor(shift(kind, anchor, 1).getTime())} disabled={view.atPresent} className="btn-ghost !p-2 !rounded-full disabled:opacity-30"><ChevronRight size={18} /></button>
      </div>

      {view.mealCount === 0 ? (
        <div className="card p-10 text-center text-[#86868b]">
          <div className="text-[40px] mb-2">🥗</div>
          本周期还没有饮食记录
        </div>
      ) : (
        <>
          {/* 综合评分 */}
          <div className="card p-5 flex items-center gap-5">
            <HealthRing score={agg.avgScore} size={84} />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[17px] font-semibold">饮食健康度 {LEVEL_META[agg.level].label}</span>
                <span>{LEVEL_META[agg.level].emoji}</span>
              </div>
              <div className="text-[13px] text-[#86868b] mt-1">
                共 {agg.mealCount} 餐 · 单餐均 {agg.kcalAvg} kcal
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <StatTile label="记录餐数" value={agg.mealCount} />
            <StatTile label="平均分" value={agg.avgScore} sub="满分 100" />
            <StatTile label="总热量" value={`${(agg.kcalTotal / 1000).toFixed(1)}k`} sub="kcal" />
          </div>

          {/* 评分趋势 */}
          {view.trend.length >= 2 && (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[15px] font-semibold flex items-center gap-1.5"><HealthIcon size={16} className="text-[#30d158]" />健康分趋势</h3>
                <span className="text-[12px] text-[#86868b]">0–100</span>
              </div>
              <Trend points={view.trend} color="#30d158" min={0} max={100} height={120} />
            </div>
          )}

          {/* 等级分布 */}
          <div className="card p-5">
            <h3 className="text-[15px] font-semibold mb-3">餐次分布</h3>
            <div className="flex h-3 rounded-full overflow-hidden">
              {(['great', 'good', 'fair', 'poor'] as const).map((lv) =>
                view.dist[lv] > 0 ? (
                  <div key={lv} style={{ width: `${(view.dist[lv] / view.mealCount) * 100}%`, background: LEVEL_META[lv].color }} title={`${LEVEL_META[lv].label} ${view.dist[lv]} 餐`} />
                ) : null
              )}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-[12px]">
              {(['great', 'good', 'fair', 'poor'] as const).map((lv) => (
                <span key={lv} className="inline-flex items-center gap-1.5 text-[#636366] dark:text-[#aeaeb2]">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: LEVEL_META[lv].color }} />
                  {LEVEL_META[lv].label} {view.dist[lv]}
                </span>
              ))}
            </div>
          </div>

          {/* 做得好 / 待改进 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="card p-5">
              <h3 className="text-[14px] font-semibold mb-3 text-[#30d158]">👍 做得好</h3>
              {agg.goodCounts.length === 0 ? <div className="text-[13px] text-[#86868b]">暂无</div> : (
                <div className="space-y-2">
                  {agg.goodCounts.slice(0, 5).map((g) => (
                    <div key={g.tag} className="flex items-center justify-between text-[13px]">
                      <span>{g.label}</span><span className="text-[#86868b]">{g.count} 次</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="card p-5">
              <h3 className="text-[14px] font-semibold mb-3 text-[#ff9f0a]">⚠️ 待改进</h3>
              {agg.issueCounts.length === 0 ? <div className="text-[13px] text-[#86868b]">暂无明显问题 🎉</div> : (
                <div className="space-y-2">
                  {agg.issueCounts.slice(0, 5).map((g) => (
                    <div key={g.tag} className="flex items-center justify-between text-[13px]">
                      <span>{g.label}</span><span className="text-[#86868b]">{g.count} 次</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 优化建议 */}
          <div className="card p-5">
            <h3 className="text-[15px] font-semibold mb-3 flex items-center gap-1.5"><SparkIcon size={16} className="text-[#0a84ff]" />本周期优化建议</h3>
            <div className="space-y-2.5">
              {agg.suggestions.map((s, i) => (
                <div key={i} className="flex items-start gap-2.5 text-[14px] leading-relaxed">
                  <span className="w-5 h-5 rounded-full bg-[#0a84ff]/12 text-[#0a84ff] text-[12px] font-semibold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                  <span>{s}</span>
                </div>
              ))}
            </div>
          </div>

          {/* AI 营养师入口 */}
          {onOpenAiChat && (
            <button onClick={onOpenAiChat} className="card w-full p-5 text-left hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shrink-0" style={{ background: 'linear-gradient(135deg,#af52de,#ff375f)' }}>
                  <SparkIcon size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[15px]">AI 营养师</div>
                  <div className="text-[12px] text-[#86868b] mt-0.5">基于你的饮食数据，给出个性化优化建议</div>
                </div>
                <span className="pill !py-0.5 !px-2 text-[10px] font-semibold text-white shrink-0" style={{ background: 'linear-gradient(135deg,#af52de,#ff375f)' }}>Ultra</span>
              </div>
            </button>
          )}
        </>
      )}
    </div>
  )
}
