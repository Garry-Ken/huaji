import type { ReactNode } from 'react'

// ---------------- 环形图（分类占比） ----------------
export interface Slice { label: string; value: number; color: string }

export function Donut({ data, size = 168, stroke = 22, center }: { data: Slice[]; size?: number; stroke?: number; center?: ReactNode }) {
  const slices = data.filter((d) => d.value > 0)
  const total = slices.reduce((s, d) => s + d.value, 0)
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  let acc = 0

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle
            cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke}
            className="stroke-[#00000008] dark:stroke-[#ffffff10]"
          />
          {total > 0 &&
            slices.map((d, i) => {
              const frac = d.value / total
              const seg = (
                <circle
                  key={i}
                  cx={size / 2} cy={size / 2} r={r} fill="none"
                  stroke={d.color} strokeWidth={stroke}
                  strokeDasharray={`${frac * c} ${c}`}
                  strokeDashoffset={-acc * c}
                  strokeLinecap="butt"
                >
                  <title>{`${d.label} ${(frac * 100).toFixed(1)}%`}</title>
                </circle>
              )
              acc += frac
              return seg
            })}
        </g>
      </svg>
      {center && <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-2">{center}</div>}
    </div>
  )
}

// ---------------- 柱状图（时间序列，响应式 flex） ----------------
export function Bars({
  data,
  height = 150,
  formatValue,
  highlightIndex,
  color,
}: {
  data: { label: string; value: number; color?: string }[]
  height?: number
  formatValue?: (v: number) => string
  highlightIndex?: number
  color?: string
}) {
  const max = Math.max(1, ...data.map((d) => d.value))
  const n = data.length
  // 标签过密时稀疏显示（保证标签数 ≤ 8，避免拥挤截断）
  const step = n <= 12 ? 1 : n <= 16 ? 2 : Math.ceil(n / 8)

  return (
    <div className="w-full">
      <div className="flex items-end gap-[3px] w-full" style={{ height }}>
        {data.map((d, i) => {
          const h = d.value > 0 ? Math.max(3, (d.value / max) * (height - 22)) : 2
          const active = i === highlightIndex
          return (
            <div key={i} className="group flex-1 flex flex-col items-center justify-end h-full min-w-0">
              <div className="text-[10px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] opacity-0 group-hover:opacity-100 transition-opacity mb-0.5 whitespace-nowrap">
                {d.value > 0 ? (formatValue ? formatValue(d.value) : Math.round(d.value)) : ''}
              </div>
              <div
                className="w-full rounded-t-[5px] transition-all duration-300"
                style={{
                  height: h,
                  background: d.color ?? (active ? (color ?? '#0a84ff') : (color ? color + '8c' : 'rgba(10,132,255,0.55)')),
                  opacity: d.value > 0 ? 1 : 0.4,
                }}
                title={`${d.label}: ${formatValue ? formatValue(d.value) : d.value}`}
              />
            </div>
          )
        })}
      </div>
      <div className="flex gap-[3px] w-full mt-1.5">
        {data.map((d, i) => (
          <div key={i} className="flex-1 text-center text-[10px] text-[#86868b] whitespace-nowrap overflow-visible">
            {i % step === 0 ? d.label : ''}
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------- 趋势折线（含面积填充） ----------------
export function Trend({
  points,
  height = 120,
  color = '#0a84ff',
  min,
  max,
}: {
  points: { label: string; value: number }[]
  height?: number
  color?: string
  min?: number
  max?: number
}) {
  const W = 100
  const vals = points.map((p) => p.value)
  const lo = min ?? Math.min(...vals, 0)
  const hi = max ?? Math.max(...vals, 1)
  const span = hi - lo || 1
  const n = points.length
  const x = (i: number) => (n <= 1 ? W / 2 : (i / (n - 1)) * W)
  const y = (v: number) => height - ((v - lo) / span) * (height - 8) - 4

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(2)} ${y(p.value).toFixed(2)}`).join(' ')
  const area = `${line} L ${W} ${height} L 0 ${height} Z`
  const gid = 'g-' + color.replace('#', '')

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={i} cx={x(i)} cy={y(p.value)} r={1.6} fill={color} vectorEffect="non-scaling-stroke">
          <title>{`${p.label}: ${Math.round(p.value)}`}</title>
        </circle>
      ))}
    </svg>
  )
}
