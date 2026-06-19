import type { Expense, HealthResult } from '../types'
import { FOOD_DB, TEXT_TAG_HINTS, type FoodTag } from './foodDb'

const GOOD_TAGS: FoodTag[] = ['蔬菜', '水果', '优质蛋白', '全谷物', '豆制品', '奶制品', '坚果', '清淡']
const BAD_TAGS: FoodTag[] = ['油炸', '高油', '高盐', '高糖', '含糖饮料', '加工肉', '精制碳水', '酒精']

const ISSUE_LABEL: Partial<Record<FoodTag, string>> = {
  油炸: '油炸高脂',
  高油: '偏油腻',
  高盐: '钠/盐偏高',
  高糖: '含糖偏高',
  含糖饮料: '含糖饮料',
  加工肉: '加工肉制品',
  精制碳水: '精制碳水为主',
  酒精: '含酒精',
}

const GOOD_LABEL: Partial<Record<FoodTag, string>> = {
  蔬菜: '含蔬菜·膳食纤维',
  水果: '含水果·维生素',
  优质蛋白: '优质蛋白',
  全谷物: '全谷物粗粮',
  豆制品: '植物蛋白',
  奶制品: '钙·乳蛋白',
  坚果: '健康脂肪',
  清淡: '清淡少油',
}

const SUGGESTION_BY_TAG: Partial<Record<FoodTag, string>> = {
  油炸: '用清蒸 / 水煮 / 空气炸代替油炸，油炸每周尽量 ≤ 2 次',
  高油: '让商家少油少糖，汤底/酱汁单独放，能去掉一半隐形油脂',
  高盐: '重口味菜少放盐和辣油，记得多喝水帮助代谢钠',
  高糖: '甜品减半，或换成原味酸奶 + 水果',
  含糖饮料: '把含糖饮料换成无糖茶 / 气泡水，一杯奶茶≈半碗饭的糖',
  加工肉: '香肠培根等加工肉偶尔吃就好，优先新鲜瘦肉/鱼虾',
  精制碳水: '主食换成杂粮饭 / 全麦，增加饱腹感和纤维',
  酒精: '酒精适量，空腹别喝，搭配清淡下酒菜',
}

/** 对一段消费文本做单餐饮食健康分析 */
export function analyzeMeal(text: string): HealthResult {
  const lower = text.toLowerCase()
  const matched = FOOD_DB.filter((f) => f.match.some((k) => lower.includes(k.toLowerCase())))

  const tagSet = new Set<FoodTag>()
  let kcal = 0
  let baseSum = 0

  for (const f of matched) {
    f.tags.forEach((t) => tagSet.add(t))
    kcal += f.kcal
    baseSum += f.score
  }
  // 文本口味线索
  for (const hint of TEXT_TAG_HINTS) {
    if (hint.match.some((k) => lower.includes(k))) tagSet.add(hint.tag)
  }

  // 没识别到具体食物：给中性结果，引导用户写得更具体
  if (matched.length === 0) {
    const onlyHints = [...tagSet]
    return {
      score: 60,
      level: 'fair',
      tags: onlyHints,
      positives: [],
      issues: onlyHints.filter((t) => BAD_TAGS.includes(t)).map((t) => ISSUE_LABEL[t] ?? t),
      suggestions: ['记录具体吃了什么（如「鸡胸 + 西兰花 + 米饭」）可得到更准的健康分析'],
      kcal: kcal || 0,
    }
  }

  const tags = [...tagSet]
  let score = Math.round(baseSum / matched.length)

  const hasVeg = tags.includes('蔬菜')
  const hasProtein = tags.some((t) => ['优质蛋白', '豆制品', '奶制品'].includes(t))
  const hasGrain = tags.some((t) => ['全谷物', '精制碳水'].includes(t))
  const badCount = tags.filter((t) => BAD_TAGS.includes(t)).length

  // 均衡加成 / 失衡扣分
  if (hasVeg && hasProtein && hasGrain) score += 10
  else if (hasVeg && hasProtein) score += 6
  if (!hasVeg && badCount > 0) score -= 6
  if (badCount >= 2) score -= 5
  score = Math.max(5, Math.min(100, score))

  const positives = tags.filter((t) => GOOD_TAGS.includes(t)).map((t) => GOOD_LABEL[t] ?? t)
  const issues = tags.filter((t) => BAD_TAGS.includes(t)).map((t) => ISSUE_LABEL[t] ?? t)

  const suggestions: string[] = []
  // 针对性建议（按问题严重度优先）
  const orderBad: FoodTag[] = ['含糖饮料', '油炸', '高糖', '高盐', '加工肉', '高油', '酒精', '精制碳水']
  for (const t of orderBad) {
    if (tags.includes(t) && SUGGESTION_BY_TAG[t]) suggestions.push(SUGGESTION_BY_TAG[t]!)
  }
  if (!hasVeg) suggestions.unshift('这餐缺少蔬菜，建议加一份青菜 / 凉拌菜补充膳食纤维')
  if (!hasProtein) suggestions.push('可补充鸡蛋 / 豆腐 / 瘦肉等优质蛋白，增强饱腹与营养')
  if (suggestions.length === 0) suggestions.push('搭配比较均衡，继续保持 👍')

  return {
    score,
    level: levelOf(score),
    tags,
    positives: dedupe(positives),
    issues: dedupe(issues),
    suggestions: suggestions.slice(0, 3),
    kcal,
  }
}

export function levelOf(score: number): HealthResult['level'] {
  if (score >= 80) return 'great'
  if (score >= 65) return 'good'
  if (score >= 45) return 'fair'
  return 'poor'
}

export const LEVEL_META: Record<HealthResult['level'], { label: string; color: string; emoji: string }> = {
  great: { label: '优秀', color: '#30d158', emoji: '🥗' },
  good: { label: '良好', color: '#a3d139', emoji: '🙂' },
  fair: { label: '一般', color: '#ff9f0a', emoji: '😐' },
  poor: { label: '偏差', color: '#ff453a', emoji: '⚠️' },
}

/** 对一组饮食消费做聚合健康分析（用于周期健康面板） */
export interface HealthAggregate {
  mealCount: number
  avgScore: number
  level: HealthResult['level']
  kcalTotal: number
  kcalAvg: number
  issueCounts: { label: string; tag: FoodTag; count: number }[]
  goodCounts: { label: string; tag: FoodTag; count: number }[]
  suggestions: string[]
}

export function aggregateHealth(foodExpenses: Expense[]): HealthAggregate {
  const meals = foodExpenses.filter((e) => e.health)
  if (meals.length === 0) {
    return { mealCount: 0, avgScore: 0, level: 'fair', kcalTotal: 0, kcalAvg: 0, issueCounts: [], goodCounts: [], suggestions: [] }
  }
  const avgScore = Math.round(meals.reduce((s, e) => s + (e.health!.score || 0), 0) / meals.length)
  const kcalTotal = meals.reduce((s, e) => s + (e.health!.kcal || 0), 0)

  const issueMap = new Map<FoodTag, number>()
  const goodMap = new Map<FoodTag, number>()
  for (const e of meals) {
    for (const t of e.health!.tags as FoodTag[]) {
      if (BAD_TAGS.includes(t)) issueMap.set(t, (issueMap.get(t) ?? 0) + 1)
      if (GOOD_TAGS.includes(t)) goodMap.set(t, (goodMap.get(t) ?? 0) + 1)
    }
  }
  const issueCounts = [...issueMap.entries()]
    .map(([tag, count]) => ({ tag, count, label: ISSUE_LABEL[tag] ?? tag }))
    .sort((a, b) => b.count - a.count)
  const goodCounts = [...goodMap.entries()]
    .map(([tag, count]) => ({ tag, count, label: GOOD_LABEL[tag] ?? tag }))
    .sort((a, b) => b.count - a.count)

  // 周期级建议：针对最高频的问题
  const suggestions: string[] = []
  for (const it of issueCounts.slice(0, 3)) {
    if (SUGGESTION_BY_TAG[it.tag]) suggestions.push(`${it.count} 次${it.label}：${SUGGESTION_BY_TAG[it.tag]}`)
  }
  const vegRate = (goodMap.get('蔬菜') ?? 0) / meals.length
  if (vegRate < 0.4) suggestions.unshift(`仅 ${Math.round(vegRate * 100)}% 的餐含蔬菜，建议每餐都加一份蔬菜`)
  if (suggestions.length === 0) suggestions.push('整体饮食结构不错，继续保持均衡 🎉')

  return {
    mealCount: meals.length,
    avgScore,
    level: levelOf(avgScore),
    kcalTotal,
    kcalAvg: Math.round(kcalTotal / meals.length),
    issueCounts,
    goodCounts,
    suggestions: suggestions.slice(0, 4),
  }
}

function dedupe(arr: string[]): string[] {
  return [...new Set(arr)]
}
