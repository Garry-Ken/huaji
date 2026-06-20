import type { CategoryId, MealType, ParseResult, TransactionType } from '../types'
import { CATEGORY_LIST } from './categories'
import { FOOD_DB } from './foodDb'
import { analyzeMeal } from './health'

// ---------- 中文数字 → 阿拉伯数字 ----------
const CN_DIGITS: Record<string, number> = {
  '零': 0, '〇': 0, '一': 1, '二': 2, '两': 2, '三': 3, '四': 4,
  '五': 5, '六': 6, '七': 7, '八': 8, '九': 9,
}
const CN_UNITS: Record<string, number> = { '十': 10, '百': 100, '千': 1000, '万': 10000 }
const CN_NUM_RE = /[零〇一二两三四五六七八九十百千万]+/g

function cnToNum(s: string): number {
  let result = 0, sub = 0, current = 0
  for (const ch of s) {
    if (ch in CN_DIGITS) {
      current = CN_DIGITS[ch]
    } else if (ch in CN_UNITS) {
      const u = CN_UNITS[ch]
      if (current === 0) current = 1
      if (u === 10000) {
        result += (sub + current) * u
        sub = 0
      } else {
        sub += current * u
      }
      current = 0
    }
  }
  return result + sub + current
}

function chineseToArabic(text: string): string {
  return text.replace(CN_NUM_RE, (m) => {
    const n = cnToNum(m)
    return n > 0 ? String(n) : m
  })
}

// ---------- 收入/支出检测 ----------
const INCOME_KW = /工资|薪水|薪资|奖金|年终奖|分红|稿费|退款|报销|利息|理财收益|投资收益|补贴|补助|津贴|佣金|提成|发工资/
const INCOME_DIR = /给我[转打发]|[转打发]给我|收到.*[钱元块]|到账|进账/

function detectType(text: string): TransactionType {
  if (INCOME_KW.test(text)) return 'income'
  if (INCOME_DIR.test(text)) return 'income'
  return 'expense'
}

// ---------- 多笔拆分 ----------
const TIME_START = /^(?:早上|早晨|上午|中午|下午|午后|傍晚|晚上|今晚|昨晚|凌晨|夜宵|宵夜|早餐|午餐|晚餐)/
const TRANS_TIME = /^(?:然后|最后|还有|另外|接着|后来|之后)\s*(?:早上|早晨|上午|中午|下午|午后|傍晚|晚上|今晚|凌晨|早餐|午餐|晚餐)/
const INCOME_START = /^(?:发工资|工资[发到]|给我[转打]|收到|到账|进账)/

function splitSegments(rawText: string): string[] {
  const text = rawText.trim()
  if (!text) return []
  const sentences = text.split(/[。；！？\n]+/).map(s => s.trim()).filter(Boolean)
  const result: string[] = []
  for (const sent of sentences) result.push(...splitWithinSentence(sent))
  return result
}

function splitWithinSentence(text: string): string[] {
  const clauses = text.split(/[，,]/)
  const segments: string[] = []
  let buffer = ''
  for (const raw of clauses) {
    const clause = raw.trim()
    if (!clause) continue
    const isNew = buffer && (
      TIME_START.test(clause) ||
      TRANS_TIME.test(clause) ||
      INCOME_START.test(clause)
    )
    if (isNew) {
      segments.push(buffer)
      buffer = clause
    } else {
      buffer = buffer ? buffer + '，' + clause : clause
    }
  }
  if (buffer) segments.push(buffer)
  return segments
}

/** 一段话 → 多笔结构化草稿 */
export function parseMultiExpense(rawText: string, now = new Date()): ParseResult[] {
  const text = normalize(rawText)
  const segments = splitSegments(text)
  if (segments.length <= 1) return [parseExpense(rawText, now)]
  let lastTime = now
  return segments.map(seg => {
    const r = parseExpense(seg, lastTime)
    lastTime = new Date(r.occurredAt)
    return r
  })
}

// 常见品牌/商家词典（命中即作为 merchant）
const BRANDS = [
  '星巴克', '瑞幸', '幸运咖', '库迪', '喜茶', '奈雪', '蜜雪冰城', '蜜雪', '茶百道', '一点点', 'coco',
  '麦当劳', '肯德基', 'kfc', '汉堡王', '必胜客', '海底捞', '西贝', '真功夫', '老乡鸡',
  '美团', '饿了么', '滴滴', '高德', '京东', '淘宝', '天猫', '拼多多', '盒马', '山姆', '沃尔玛',
  '全家', '罗森', '711', '7-11', '便利蜂', '永辉', '物美',
]

// 地点线索词（独立出现也算地点）
const PLACE_WORDS = ['楼下', '公司', '家里', '家', '学校', '商场', '地铁站', '机场', '火车站', '小区', '办公室', '食堂']

const MEAL_HOUR: Record<MealType, number> = { breakfast: 8, lunch: 12, dinner: 19, snack: 22 }

/** 解析入口：一句话 -> 结构化草稿 */
export function parseExpense(rawText: string, now = new Date()): ParseResult {
  const text = normalize(rawText)
  const numText = chineseToArabic(text)
  const lower = text.toLowerCase()

  const amount = extractAmount(numText)
  const { time, meal: mealFromTime } = extractTime(numText, now)
  const merchant = extractMerchant(lower)
  const location = extractLocation(text) ?? (merchant ? undefined : undefined)

  const foodHits = FOOD_DB.filter((f) => f.match.some((k) => lower.includes(k.toLowerCase())))
  const txType = detectType(text)
  const category: CategoryId = txType === 'income' ? 'income' : classify(lower, foodHits.length > 0)

  const items = dedupe(foodHits.map((f) => f.name))
  const title = buildTitle({ text: lower, category, items, merchant })

  const meal: MealType | undefined = category === 'food' ? mealFromTime ?? mealByHour(time) : undefined
  const health = category === 'food' ? analyzeMeal(text) : undefined

  let confidence = 0.4
  if (amount != null) confidence += 0.3
  if (category !== 'other') confidence += 0.2
  if (items.length || merchant) confidence += 0.1
  confidence = Math.min(1, confidence)

  return { type: txType, amount, category, title, items, merchant, location, occurredAt: time, meal, health, confidence }
}

// ---------- 金额 ----------
function extractAmount(text: string): number | null {
  // 28块5 / 28块5毛
  const km = text.match(/(\d+)\s*块\s*(\d)\s*(?:毛|角)?/)
  if (km) return round2(parseInt(km[1], 10) + parseInt(km[2], 10) / 10)

  // ¥28 / 28.5元 / 28块 / RMB 28
  const unit =
    text.match(/(?:¥|￥|\$)\s*(\d+(?:\.\d+)?)/) ||
    text.match(/(\d+(?:\.\d+)?)\s*(?:元|块钱|块|圆|rmb|刀|美元)/i)
  if (unit) return round2(parseFloat(unit[1]))

  // 花了/付了/消费/充了/转了/发了/收到 28
  const verb = text.match(/(?:花了?|付了?|消费了?|用了?|充了?|交了?|转了?|发了?|收到|spent|cost)\s*(\d+(?:\.\d+)?)/i)
  if (verb) return round2(parseFloat(verb[1]))

  // 兜底：取最后一个不像「时间/数量」的数字
  const tokens = [...text.matchAll(/(\d+(?:\.\d+)?)\s*([点号月日年岁周楼路班杯个只份位斤克ml毫升]?)/g)]
  const moneyish = tokens.filter((t) => !t[2]) // 后面没有时间/量词单位的
  if (moneyish.length) return round2(parseFloat(moneyish[moneyish.length - 1][1]))
  return null
}

// ---------- 时间 ----------
function extractTime(text: string, now: Date): { time: number; meal?: MealType } {
  const d = new Date(now)
  let meal: MealType | undefined

  // 相对日期
  if (/前天/.test(text)) d.setDate(d.getDate() - 2)
  else if (/昨天|昨晚/.test(text)) d.setDate(d.getDate() - 1)
  else if (/大前天/.test(text)) d.setDate(d.getDate() - 3)

  // 绝对日期 X月Y日/号
  const md = text.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*[日号]/)
  if (md) {
    d.setMonth(parseInt(md[1], 10) - 1)
    d.setDate(parseInt(md[2], 10))
  }

  // 时段词（按在文本中最早出现的匹配为准）
  const periods: { re: RegExp; hour: number; meal?: MealType }[] = [
    { re: /早上|早晨|清晨|早餐|早饭/, hour: 8, meal: 'breakfast' },
    { re: /上午/, hour: 10 },
    { re: /中午|午餐|午饭|正午/, hour: 12, meal: 'lunch' },
    { re: /下午|午后/, hour: 15 },
    { re: /傍晚/, hour: 18 },
    { re: /晚上|晚餐|晚饭|今晚|昨晚/, hour: 19, meal: 'dinner' },
    { re: /夜宵|宵夜|深夜|半夜|凌晨/, hour: 22, meal: 'snack' },
  ]
  let hourSet = false
  let bestPeriod: (typeof periods)[0] | null = null
  let bestPos = Infinity
  for (const p of periods) {
    const m = text.match(p.re)
    if (m && m.index != null && m.index < bestPos) {
      bestPos = m.index
      bestPeriod = p
    }
  }
  if (bestPeriod) {
    d.setHours(bestPeriod.hour, 0, 0, 0)
    if (bestPeriod.meal) meal = bestPeriod.meal
    hourSet = true
  }

  // 精确时刻 X点 / X:Y（结合下午/晚上判断 12 小时制）
  const clock = text.match(/(\d{1,2})\s*[点:：]\s*(\d{1,2})?/)
  if (clock) {
    let h = parseInt(clock[1], 10)
    const m = clock[2] ? parseInt(clock[2], 10) : 0
    if (/下午|晚上|傍晚|夜/.test(text) && h < 12) h += 12
    d.setHours(h, m, 0, 0)
    hourSet = true
  }

  if (!hourSet && md) d.setHours(12, 0, 0, 0) // 只给了日期时默认中午
  return { time: d.getTime(), meal }
}

function mealByHour(ts: number): MealType {
  const h = new Date(ts).getHours()
  if (h >= 5 && h < 10) return 'breakfast'
  if (h >= 10 && h < 14) return 'lunch'
  if (h >= 16 && h < 22) return 'dinner'
  return 'snack'
}

// ---------- 分类 ----------
function classify(lower: string, isFood: boolean): CategoryId {
  if (/请(同事|朋友|人|同学|老师|客人|领导|他|她|大家)/.test(lower)) return 'social'

  const scores = new Map<CategoryId, number>()
  for (const cat of CATEGORY_LIST) {
    if (cat.id === 'income') continue
    let s = 0
    for (const kw of cat.keywords) if (lower.includes(kw.toLowerCase())) s += kw.length >= 2 ? 2 : 1
    if (s > 0) scores.set(cat.id, s)
  }
  if (isFood) scores.set('food', (scores.get('food') ?? 0) + 5)

  let best: CategoryId = 'other'
  let max = 0
  for (const [id, s] of scores) if (s > max) { max = s; best = id }
  return best
}

// ---------- 商家 / 地点 / 标题 ----------
function extractMerchant(lower: string): string | undefined {
  const hit = BRANDS.find((b) => lower.includes(b.toLowerCase()))
  return hit
}

function extractLocation(text: string): string | undefined {
  // 在XXX（吃/喝/买/...）
  const m = text.match(/在([一-龥A-Za-z0-9]{1,12}?)(?:吃|喝|买|花|付|消费|点了|，|,|。|；|;|\s|$)/)
  if (m && m[1]) return m[1]
  const place = PLACE_WORDS.find((p) => text.includes(p))
  return place
}

function buildTitle(args: { text: string; category: CategoryId; items: string[]; merchant?: string }): string {
  const { text, category, items, merchant } = args
  if (items.length) return items.slice(0, 3).join('、')
  if (merchant) return merchant
  for (const cat of CATEGORY_LIST) {
    const kw = cat.keywords.find((k) => text.includes(k.toLowerCase()) && k.length >= 2)
    if (kw) return kw
  }
  if (category === 'income') return '收入'
  return ''
}

// ---------- 工具 ----------
function normalize(s: string): string {
  return s
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)) // 全角数字
    .replace(/￥/g, '¥')
    .trim()
}
function round2(n: number): number {
  return Math.round(n * 100) / 100
}
function dedupe(arr: string[]): string[] {
  return [...new Set(arr)]
}

export { MEAL_HOUR }
