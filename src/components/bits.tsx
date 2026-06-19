import type { ReactNode } from 'react'
import type { CategoryId, MealType } from '../types'
import { categoryMeta } from '../lib/categories'
import { LEVEL_META, levelOf } from '../lib/health'

const MEAL_LABEL: Record<MealType, string> = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐', snack: '加餐' }

export function MealTag({ meal }: { meal: MealType }) {
  return (
    <span className="pill bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#636366] dark:text-[#aeaeb2] !py-0.5 !px-2 text-[11px]">
      {MEAL_LABEL[meal]}
    </span>
  )
}

export function CategoryTag({ id, size = 'md' }: { id: CategoryId; size?: 'sm' | 'md' }) {
  const m = categoryMeta(id)
  return (
    <span
      className={`pill font-medium ${size === 'sm' ? '!py-0.5 !px-2 text-[11px]' : ''}`}
      style={{ background: m.color + '1f', color: m.color }}
    >
      <span>{m.emoji}</span>
      {m.label}
    </span>
  )
}

/** 健康分小圆环 */
export function HealthRing({ score, size = 44 }: { score: number; size?: number }) {
  const level = levelOf(score)
  const meta = LEVEL_META[level]
  const stroke = Math.max(3, size * 0.1)
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const frac = Math.max(0, Math.min(1, score / 100))
  return (
    <div className="relative inline-flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-[#00000010] dark:stroke-[#ffffff14]" />
          <circle
            cx={size / 2} cy={size / 2} r={r} fill="none" stroke={meta.color} strokeWidth={stroke}
            strokeDasharray={`${frac * c} ${c}`} strokeLinecap="round"
          />
        </g>
      </svg>
      <span className="absolute font-semibold" style={{ color: meta.color, fontSize: size * 0.32 }}>
        {Math.round(score)}
      </span>
    </div>
  )
}

export function HealthLevelTag({ score }: { score: number }) {
  const m = LEVEL_META[levelOf(score)]
  return (
    <span className="pill !py-0.5 !px-2 text-[11px] font-medium" style={{ background: m.color + '22', color: m.color }}>
      {m.emoji} {m.label}
    </span>
  )
}

export function StatTile({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="rounded-2xl bg-[#f5f5f7] dark:bg-[#2c2c2e]/60 px-3.5 py-3">
      <div className="text-[12px] text-[#86868b]">{label}</div>
      <div className="text-[19px] font-semibold mt-0.5 leading-tight">{value}</div>
      {sub != null && <div className="text-[11px] text-[#86868b] mt-0.5">{sub}</div>}
    </div>
  )
}
