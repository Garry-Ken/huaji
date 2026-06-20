import type { Expense, InputSource } from '../types'
import { parseExpense } from './parser'
import { uid } from './storage'

// 用真实句子跑解析器来造数据，保证示例与线上引擎完全一致
const PLACES = ['公司楼下', '家附近', '商场', '地铁站旁', '学校食堂', '小区门口']
const SOURCES: InputSource[] = ['text', 'text', 'text', 'voice', 'paste']

const BREAKFAST = ['包子豆浆', '煎饼果子', '三明治和牛奶', '燕麦加水果', '吐司咖啡', '鸡蛋瘦肉粥', '全麦面包牛奶']
const LUNCH = ['麻辣烫', '黄焖鸡米饭', '鸡胸沙拉', '日料寿司', '兰州拉面', '排骨盖浇饭', '麦当劳汉堡套餐', '轻食沙拉', '番茄牛肉面', '扬州炒饭', '螺蛳粉']
const DINNER = ['火锅', '烧烤撸串', '清蒸鱼青菜米饭', '水煮鱼', '炸鸡配可乐', '西兰花鸡胸糙米饭', '猪肉白菜饺子', '披萨', '麻辣香锅', '青菜豆腐家常菜', '寿司']
const SNACK = ['一杯奶茶', '蛋糕', '一份水果', '坚果', '薯条', '冰淇淋', '美式咖啡']

function pick<T>(a: T[]): T { return a[Math.floor(Math.random() * a.length)] }
function rand(min: number, max: number): number { return Math.floor(min + Math.random() * (max - min + 1)) }
function chance(p: number): boolean { return Math.random() < p }

function build(text: string, base: Date, source: InputSource, hour?: number): Expense {
  const b = new Date(base)
  if (hour != null) b.setHours(hour, rand(0, 59), 0, 0)
  const p = parseExpense(text, b)
  const occurredAt = p.occurredAt
  return {
    id: uid(),
    type: p.type ?? 'expense',
    amount: p.amount ?? rand(10, 60),
    category: p.category,
    title: p.title || text.slice(0, 10),
    items: p.items,
    merchant: p.merchant,
    location: p.location,
    occurredAt,
    createdAt: Math.min(Date.now(), occurredAt + rand(2, 90) * 60000),
    source,
    rawText: text,
    meal: p.meal,
    health: p.health,
  }
}

/** 生成约 150 天的示例消费，覆盖周/月/季/半年/年视图 */
export function generateSample(days = 150): Expense[] {
  const out: Expense[] = []
  const today = new Date()
  for (let i = days; i >= 0; i--) {
    const day = new Date(today)
    day.setDate(today.getDate() - i)
    const src = () => pick(SOURCES)

    // 三餐
    if (chance(0.7)) out.push(build(`早上吃了${pick(BREAKFAST)} ${rand(6, 18)}元`, day, src()))
    if (chance(0.95)) out.push(build(`中午在${pick(PLACES)}吃了${pick(LUNCH)} ${rand(15, 45)}元`, day, src()))
    if (chance(0.9)) out.push(build(`晚上${pick(DINNER)}花了${rand(22, 85)}元`, day, src()))
    if (chance(0.35)) out.push(build(`下午买了${pick(SNACK)} ${rand(8, 32)}元`, day, src()))

    // 交通
    if (chance(0.4)) {
      const t = pick([`打车回家 ${rand(15, 48)}元`, `地铁 ${rand(4, 12)}元`, `滴滴 ${rand(18, 60)}元`, `共享单车 ${rand(1, 4)}元`, `加油 ${rand(200, 400)}元`])
      out.push(build(t, day, src(), rand(8, 21)))
    }
    // 购物
    if (chance(0.16)) {
      const t = pick([`淘宝买了件衣服 ${rand(80, 360)}元`, `京东买日用品 ${rand(30, 150)}元`, `超市购物 ${rand(40, 200)}元`, `买了双鞋 ${rand(200, 600)}元`])
      out.push(build(t, day, src(), rand(10, 22)))
    }
    // 娱乐
    if (chance(0.12)) {
      const t = pick([`看电影 ${rand(35, 90)}元`, `游戏充值 ${rand(6, 128)}元`, `健身房 ${rand(30, 100)}元`, `视频会员 ${rand(15, 30)}元`])
      out.push(build(t, day, src(), rand(14, 23)))
    }
    // 医疗 / 社交 / 通讯
    if (chance(0.03)) out.push(build(`药店买药 ${rand(20, 120)}元`, day, src(), rand(9, 20)))
    if (chance(0.05)) out.push(build(`请客吃饭 ${rand(120, 400)}元`, day, src(), 19))
    if (day.getDate() === 10) out.push(build(`充话费 ${pick([50, 100, 100, 200])}元`, day, src(), 12))

    // 居住（每月固定）
    if (day.getDate() === 1) out.push(build(`房租 ${pick([2200, 2800, 3200, 3500])}元`, day, src(), 10))
    if (day.getDate() === 6) out.push(build(`水电燃气费 ${rand(120, 320)}元`, day, src(), 11))
  }
  return out
}
