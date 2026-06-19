/** ¥ 金额格式化：整数不带小数，非整数保留两位，千分位 */
export function yuan(n: number): string {
  const v = Math.round(n * 100) / 100
  const isInt = Math.abs(v - Math.round(v)) < 1e-9
  const str = isInt
    ? Math.round(v).toLocaleString('zh-CN')
    : v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return '¥' + str
}

/** 只要数字部分（用于大号展示，符号单独放） */
export function yuanNum(n: number): string {
  return yuan(n).slice(1)
}

export function timeShort(ts: number): string {
  const d = new Date(ts)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function dateTimeShort(ts: number): string {
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function relativeDay(ts: number, now = Date.now()): string {
  const a = new Date(ts); a.setHours(0, 0, 0, 0)
  const b = new Date(now); b.setHours(0, 0, 0, 0)
  const diff = Math.round((b.getTime() - a.getTime()) / 86400000)
  if (diff === 0) return '今天'
  if (diff === 1) return '昨天'
  if (diff === 2) return '前天'
  return `${a.getMonth() + 1}月${a.getDate()}日`
}

function pad(n: number): string {
  return n < 10 ? '0' + n : String(n)
}
