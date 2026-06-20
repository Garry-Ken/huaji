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
// 优先级：支出方向 > 收入方向 > 支出关键词 > 收入关键词 > 默认支出
//
// "方向"指有明确资金流向的句式（给谁转/谁给我转），优先级最高。
// "关键词"指动作本身就暗含方向（买了=出，工资=入）。

// ① 支出方向：我 → 别人（转出、借出、送出、还出）
const EXPENSE_DIR = new RegExp([
  // 给+亲属/他人+转打发：给我妈转了、给他打了、给朋友发了
  '给我[妈爸爹娘哥姐弟妹嫂叔婶姑姨舅伯]',
  '给[^我].{0,3}[转打发]了',
  '给我.{1,4}[转打发]了',       // 给我朋友转了（我和转之间有人名）
  // 转给/打给/发给+非"我"
  '[转打发]给[^我]',
  '转给', '转账给',
  // 我主动转出
  '我给.{0,4}[转打发]', '我[转打发]了',
  // 借出/送出/还出/寄出
  '借给', '送给', '寄给', '还给',
  '借了.{0,4}给',
  // 红包发出
  '发了?\\d+.*红包', '发了?.*红包',
  // 请客
  '请.{0,4}吃', '请.{0,4}喝', '请客',
].join('|'))

// ② 收入方向：别人 → 我（转入、收到、还我）
const INCOME_DIR = new RegExp([
  // 给我+直接转打发（中间无人名）
  '给我[转打发]',
  '[转打发]给我',
  // 收到
  '收到', '收了',
  // 到账/进账/入账
  '到账', '进账', '入账',
  // 还我
  '还我', '还了我',
  // 赚/挣+数字
  '赚[了到]?\\s*\\d', '挣[了到]?\\s*\\d',
  '卖[了出]\\s*\\d',
].join('|'))

// ③ 支出关键词：动作本身=花钱
const EXPENSE_KW = new RegExp([
  // 购买/消费
  '买了', '花了', '花掉', '消费', '支出', '开销', '开支',
  // 支付
  '付了', '付款', '付费', '支付', '扫码付', '刷卡',
  // 缴费
  '缴费', '缴纳', '交了', '交费',
  // 充值/还款
  '充值', '充了', '充钱',
  '还款', '还贷', '还花呗', '还信用卡', '还借呗', '还白条',
  // 生活费用
  '房租(?!收入)', '水电', '物业', '燃气', '暖气', '宽带', '话费', '网费',
  // 教育/医疗
  '学费', '书费', '培训费', '课程费',
  '药费', '医疗费', '手术费', '挂号', '门诊', '住院',
  // 罚款/捐款
  '罚款', '罚了', '捐了', '捐款', '捐赠',
  // 维修
  '修了', '修理', '维修费',
  // 定金/押金
  '定金', '押金', '保证金',
  // 保险
  '保费', '保险费',
  // 停车/加油
  '停车费', '加油',
  // 红包（发出去）
  '发红包', '发了红包', '发了.*红包', '包红包',
  // 打赏出去
  '打赏了',
].join('|'))

// ④ 收入关键词：动作本身=进钱
const INCOME_KW = new RegExp([
  // 工资/薪资
  '工资', '薪水', '薪资', '发工资', '发薪', '底薪', '基本工资',
  // 奖金/分红
  '奖金', '年终奖', '绩效奖', '分红', '股息',
  // 赚/挣
  '赚了', '赚到', '赚钱', '挣了', '挣到', '挣钱', '净赚',
  // 收入类型
  '稿费', '版税', '佣金', '提成', '抽成', '外快', '兼职', '接单', '私活', '带货',
  // 退款/报销
  '退款', '退了', '退钱', '报销',
  // 利息/投资
  '利息', '理财收益', '投资收益', '收益', '营收', '盈利', '利润',
  // 租金收入
  '收租', '租金收入', '房租收入',
  // 商业回款
  '回款', '尾款', '货款', '进货款',
  // 补贴
  '补贴', '补助', '津贴',
  // 其他
  '中奖', '收到红包', '抢到红包', '收钱', '收款', '收到款', '转账收入',
  // 卖出
  '卖了', '卖出', '卖掉', '出手',
  // 打赏收入（别人打赏我）
  '打赏', '收到打赏',
].join('|'))

// ⑤ 借贷检测
const DEBT_LEND = /借给|借出|借了.{0,4}给/
const DEBT_BORROW = /向.{0,4}借|跟.{0,4}借|找.{0,4}借|问.{0,4}借|借我|借入/
const DEBT_SETTLE = /还我|还给|清账|结清|还了?\s*\d/
const DEBT_ANY = /借给|借出|借了|借我|借入|向.{0,3}借|跟.{0,3}借|找.{0,3}借|欠|还我|还给|清账|结清/

function detectDebt(text: string): { isDebt: boolean; type: TransactionType } | null {
  if (!DEBT_ANY.test(text)) return null
  if (DEBT_LEND.test(text)) return { isDebt: true, type: 'expense' }
  if (DEBT_BORROW.test(text)) return { isDebt: true, type: 'income' }
  if (DEBT_SETTLE.test(text)) {
    if (/还我|还了我/.test(text)) return { isDebt: true, type: 'income' }
    if (/还给|我还/.test(text)) return { isDebt: true, type: 'expense' }
    return { isDebt: true, type: 'expense' }
  }
  return null
}

// ⑥ 交易对方提取
const NON_PERSON = new Set(['还款','还贷','还花呗','还信用卡','还借呗','还白条','还钱','账','房租','利息','给我'])
const PERSON_PATTERNS: [RegExp, number][] = [
  [/借给([一-鿿]{1,4})/, 1],
  [/借([一-鿿]{1,4})\d/, 1],
  [/([一-鿿]{1,4})借我/, 1],
  [/向([一-鿿]{1,4})借/, 1],
  [/跟([一-鿿]{1,4})借/, 1],
  [/找([一-鿿]{1,4})借/, 1],
  [/问([一-鿿]{1,4})借/, 1],
  [/还给([一-鿿]{1,4})/, 1],
  [/([一-鿿]{1,4})还我/, 1],
  [/欠([一-鿿]{1,4})/, 1],
  [/([一-鿿]{1,4})欠我/, 1],
]

function extractCounterparty(text: string): string | undefined {
  for (const [re, group] of PERSON_PATTERNS) {
    const m = text.match(re)
    if (m && m[group] && !NON_PERSON.has(m[group])) return m[group]
  }
  return undefined
}

function detectType(text: string): TransactionType {
  const hasExpDir = EXPENSE_DIR.test(text)
  const hasIncDir = INCOME_DIR.test(text)
  if (hasExpDir && !hasIncDir) return 'expense'
  if (hasIncDir && !hasExpDir) return 'income'
  if (hasExpDir && hasIncDir) return 'income'
  if (EXPENSE_KW.test(text)) return 'expense'
  if (INCOME_KW.test(text)) return 'income'
  return 'expense'
}

// ---------- 多笔拆分 ----------
const TIME_START = /^(?:早上|早晨|上午|中午|下午|午后|傍晚|晚上|今晚|昨晚|凌晨|夜宵|宵夜|早餐|午餐|晚餐)/
const TRANS_TIME = /^(?:然后|最后|还有|另外|接着|后来|之后)\s*(?:早上|早晨|上午|中午|下午|午后|傍晚|晚上|今晚|凌晨|早餐|午餐|晚餐)/
const INCOME_START = /^(?:发工资|工资[发到]|给我[转打]|收到|到账|进账)/

const AMOUNT_ONLY_RE = /^\d+(?:\.\d+)?\s*(?:元|块钱?|块|圆|刀|美元|rmb|¥|￥)?$/i

function splitSegments(rawText: string): string[] {
  const text = rawText.trim()
  if (!text) return []
  const sentences = text.split(/[。；！？\n]+/).map(s => s.trim()).filter(Boolean)
  const raw: string[] = []
  for (const sent of sentences) raw.push(...splitWithinSentence(sent))
  // Merge amount-only segments (e.g. "19块") back into the previous segment
  const result: string[] = []
  for (const seg of raw) {
    if (result.length > 0 && AMOUNT_ONLY_RE.test(seg)) {
      result[result.length - 1] += '，' + seg
    } else {
      result.push(seg)
    }
  }
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

  const debt = detectDebt(text)
  const txType = debt ? debt.type : detectType(text)
  const counterparty = debt ? extractCounterparty(text) : undefined
  const isDebt = debt?.isDebt ?? false

  const category: CategoryId = txType === 'income' ? 'income' : isDebt ? 'social' : classify(lower, foodHits.length > 0)

  const items = extractFoodNames(text, foodHits)
  const title = buildTitle({ text: lower, category, items, merchant })

  const meal: MealType | undefined = category === 'food' ? mealFromTime ?? mealByHour(time) : undefined
  const health = category === 'food' ? analyzeMeal(text) : undefined

  let confidence = 0.4
  if (amount != null) confidence += 0.3
  if (category !== 'other') confidence += 0.2
  if (items.length || merchant) confidence += 0.1
  confidence = Math.min(1, confidence)

  return { type: txType, amount, category, title, items, merchant, location, occurredAt: time, meal, health, confidence, counterparty, isDebt: isDebt || undefined }
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

  // 花了/付了/消费/充了/转了/发了/收到/赚了/挣了 28
  const verb = text.match(/(?:花了?|付了?|消费了?|用了?|充了?|交了?|转了?|发了?|收到|赚了?|挣了?|spent|cost)\s*(\d+(?:\.\d+)?)/i)
  if (verb) return round2(parseFloat(verb[1]))

  // 兜底：取最后一个不像「时间/数量」的数字
  const tokens = [...text.matchAll(/(\d+(?:\.\d+)?)\s*([点号月日年岁周楼路班杯个只份位斤克ml毫升]?)/g)]
  const moneyish = tokens.filter((t) => {
    if (t[2]) return false // 后面有时间/量词单位
    // 排除时间模式中的数字：12:30 的 "30"，或 "12" 后面紧跟 ":"
    const idx = t.index!
    if (idx > 0 && /[:：]/.test(text[idx - 1])) return false // "30" in "12:30"
    const end = idx + t[1].length
    if (end < text.length && /[:：]/.test(text[end])) return false // "12" in "12:30"
    return true
  })
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

const NOISE_RE = /\d+(?:\.\d+)?\s*(?:元|块钱?|¥|￥)?/gi
const VERB_RE = /(?:吃(?:了|饭|了饭)?|喝(?:了|水|了水)?|买了?|点了?|花了?|来[一个份碗杯]|中午|下午|上午|晚上|今天|昨天|在\S{1,4})/g
const QUANTIFIER_FOOD_RE = /(?:吃了?|喝了?|买了?|点了?|来了?|煮了?|做了?|烤了?|炸了?|蒸了?|炒了?|嚼了?|啃了?|嗑了?)\s*(?:一|两|三|几|点|些)?\s*(?:碗|杯|个|份|根|串|盒|袋|瓶|块|片|盘|包|桶|罐|条|把|颗|粒|口|块儿)\s*([一-鿿]{1,6})/

const QUANTITY_RE = /[一二两三四五六七八九十\d]+\s*[份碗杯个只盒袋瓶块片盘包桶罐条把颗粒串根]/g

function extractFoodNames(text: string, foodHits: { match: string[]; name: string }[]): string[] {
  const lower = text.toLowerCase()
  const segments = text.split(/[，,、；;。！？\n]+/).map(s => s.trim()).filter(Boolean)
  if (segments.length > 1) {
    const names: string[] = []
    for (const seg of segments) {
      const clean = seg.replace(NOISE_RE, '').replace(VERB_RE, '').replace(QUANTITY_RE, '').replace(/[块元角毛]$/, '').trim()
      if (clean.length < 2 || clean.length > 12) continue
      if (/^\d+$/.test(clean)) continue
      if (!/[一-鿿]/.test(clean)) continue
      names.push(clean)
    }
    if (names.length > 0) return dedupe(names).slice(0, 4)
  }

  if (foodHits.length > 0) {
    const matched: string[] = []
    for (const f of foodHits) {
      let best = ''
      for (const k of f.match) {
        if (lower.includes(k.toLowerCase()) && k.length > best.length) best = k
      }
      if (best) matched.push(best)
    }
    // Remove shorter matches that are substrings of longer ones
    const filtered = matched.filter(a => !matched.some(b => b.length > a.length && b.includes(a)))
    if (filtered.length > 0) return dedupe(filtered)
  }

  // Fallback: extract food name after quantifier: "吃了碗粥" "喝了杯豆浆" "吃了根冰棍"
  const qm = text.match(QUANTIFIER_FOOD_RE)
  if (qm && qm[1]) {
    const foodName = qm[1].replace(/\d+.*$/, '').trim()
    if (foodName.length >= 1) return [foodName]
  }

  return []
}

const INCOME_TITLE_MAP: [RegExp, string][] = [
  [/工资|薪水|月薪/, '工资'],
  [/奖金|年终/, '奖金'],
  [/红包/, '红包'],
  [/退款|退货/, '退款'],
  [/报销/, '报销'],
  [/利息|理财|收益/, '理财收益'],
  [/兼职|外快/, '兼职'],
  [/稿费|稿酬/, '稿费'],
  [/转账|转入/, '转账'],
  [/还我|还钱|还款/, '还款'],
  [/卖了|卖出/, '出售'],
  [/租金|房租/, '租金'],
  [/补贴|补助|津贴/, '补贴'],
]

function buildTitle(args: { text: string; category: CategoryId; items: string[]; merchant?: string }): string {
  const { text, category, items, merchant } = args
  if (items.length) return items.slice(0, 4).join('、')
  if (merchant) return merchant
  if (category === 'income') {
    for (const [re, label] of INCOME_TITLE_MAP) {
      if (re.test(text)) return label
    }
    return '收入'
  }
  for (const cat of CATEGORY_LIST) {
    const kw = cat.keywords.find((k) => text.includes(k.toLowerCase()) && k.length >= 2)
    if (kw) return kw
  }
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
