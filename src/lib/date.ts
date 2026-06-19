import type { PeriodKind } from '../types'

export interface Bucket {
  label: string
  start: number
  end: number // 独占上界 [start, end)
}

const DAY = 86400000

export function startOfDay(d: Date | number): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

/** 周一为一周开始 */
export function startOfWeek(d: Date | number): Date {
  const x = startOfDay(d)
  const wd = (x.getDay() + 6) % 7 // 周一=0
  x.setDate(x.getDate() - wd)
  return x
}

export function startOfMonth(d: Date | number): Date {
  const x = startOfDay(d)
  x.setDate(1)
  return x
}

export function periodRange(kind: PeriodKind, anchor: Date | number): { start: number; end: number } {
  const a = new Date(anchor)
  switch (kind) {
    case 'day': {
      const s = startOfDay(a)
      return { start: s.getTime(), end: s.getTime() + DAY }
    }
    case 'week': {
      const s = startOfWeek(a)
      return { start: s.getTime(), end: s.getTime() + 7 * DAY }
    }
    case 'month': {
      const s = startOfMonth(a)
      const e = new Date(s)
      e.setMonth(e.getMonth() + 1)
      return { start: s.getTime(), end: e.getTime() }
    }
    case 'quarter': {
      const q = Math.floor(a.getMonth() / 3)
      const s = new Date(a.getFullYear(), q * 3, 1)
      const e = new Date(a.getFullYear(), q * 3 + 3, 1)
      return { start: s.getTime(), end: e.getTime() }
    }
    case 'half': {
      const h = a.getMonth() < 6 ? 0 : 6
      const s = new Date(a.getFullYear(), h, 1)
      const e = new Date(a.getFullYear(), h + 6, 1)
      return { start: s.getTime(), end: e.getTime() }
    }
    case 'year': {
      const s = new Date(a.getFullYear(), 0, 1)
      const e = new Date(a.getFullYear() + 1, 0, 1)
      return { start: s.getTime(), end: e.getTime() }
    }
  }
}

export function shift(kind: PeriodKind, anchor: Date | number, delta: number): Date {
  const a = new Date(anchor)
  switch (kind) {
    case 'day': a.setDate(a.getDate() + delta); break
    case 'week': a.setDate(a.getDate() + 7 * delta); break
    case 'month': a.setMonth(a.getMonth() + delta); break
    case 'quarter': a.setMonth(a.getMonth() + 3 * delta); break
    case 'half': a.setMonth(a.getMonth() + 6 * delta); break
    case 'year': a.setFullYear(a.getFullYear() + delta); break
  }
  return a
}

const WD = ['日', '一', '二', '三', '四', '五', '六']

export function periodLabel(kind: PeriodKind, anchor: Date | number): string {
  const a = new Date(anchor)
  const y = a.getFullYear()
  switch (kind) {
    case 'day':
      return `${a.getMonth() + 1}月${a.getDate()}日 周${WD[a.getDay()]}`
    case 'week': {
      const s = startOfWeek(a)
      const e = new Date(s.getTime() + 6 * DAY)
      return `${s.getMonth() + 1}/${s.getDate()} – ${e.getMonth() + 1}/${e.getDate()}`
    }
    case 'month':
      return `${y}年${a.getMonth() + 1}月`
    case 'quarter':
      return `${y}年 Q${Math.floor(a.getMonth() / 3) + 1}`
    case 'half':
      return `${y}年 ${a.getMonth() < 6 ? '上半年' : '下半年'}`
    case 'year':
      return `${y}年`
  }
}

/** 周期内用于柱状图的子桶 */
export function subBuckets(kind: PeriodKind, anchor: Date | number): Bucket[] {
  const { start, end } = periodRange(kind, anchor)
  switch (kind) {
    case 'day': {
      // 4 个时段
      const slots = [
        { label: '早', h0: 5, h1: 11 },
        { label: '午', h0: 11, h1: 16 },
        { label: '晚', h0: 16, h1: 22 },
        { label: '夜', h0: 22, h1: 29 },
      ]
      return slots.map((s) => {
        const st = new Date(start); st.setHours(s.h0, 0, 0, 0)
        const en = new Date(start); en.setHours(s.h1, 0, 0, 0)
        return { label: s.label, start: st.getTime(), end: en.getTime() }
      })
    }
    case 'week': {
      const out: Bucket[] = []
      for (let i = 0; i < 7; i++) {
        const st = start + i * DAY
        out.push({ label: '周' + WD[new Date(st).getDay()], start: st, end: st + DAY })
      }
      return out
    }
    case 'month': {
      const out: Bucket[] = []
      for (let t = start; t < end; t += DAY) {
        out.push({ label: String(new Date(t).getDate()), start: t, end: t + DAY })
      }
      return out
    }
    case 'quarter':
    case 'half':
    case 'year': {
      const out: Bucket[] = []
      const cur = new Date(start)
      while (cur.getTime() < end) {
        const st = new Date(cur)
        const en = new Date(cur); en.setMonth(en.getMonth() + 1)
        out.push({ label: `${st.getMonth() + 1}月`, start: st.getTime(), end: en.getTime() })
        cur.setMonth(cur.getMonth() + 1)
      }
      return out
    }
  }
}

export { DAY }
