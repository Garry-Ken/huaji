// ---- 核心数据模型 ----

export type CategoryId =
  | 'food'
  | 'transport'
  | 'shopping'
  | 'entertainment'
  | 'housing'
  | 'medical'
  | 'education'
  | 'communication'
  | 'social'
  | 'other'

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export type InputSource = 'text' | 'voice' | 'paste' | 'manual'

/** 单笔饮食健康分析结果 */
export interface HealthResult {
  score: number // 0-100
  level: 'great' | 'good' | 'fair' | 'poor'
  tags: string[] // 命中的营养/烹饪标签，如 "油炸" "蔬菜"
  positives: string[] // 做得好的点
  issues: string[] // 问题点
  suggestions: string[] // 优化建议
  kcal: number // 估算热量 (kcal)
}

/** 一笔消费记录 */
export interface Expense {
  id: string
  amount: number // 金额（元）
  category: CategoryId
  title: string // 简短标题，如 "麻辣烫"
  items: string[] // 明细项（饮食类尤其有用）
  merchant?: string // 商家 / 品牌
  location?: string // 地点
  note?: string
  occurredAt: number // 消费实际发生时间(ms)，由解析推断
  createdAt: number // 原始录入时间(ms)
  source: InputSource
  rawText: string // 原始输入文本
  meal?: MealType // 餐次（饮食类）
  health?: HealthResult // 饮食健康分析（饮食类）
}

/** 解析器产出（写入存储前的草稿） */
export interface ParseResult {
  amount: number | null
  category: CategoryId
  title: string
  items: string[]
  merchant?: string
  location?: string
  occurredAt: number
  meal?: MealType
  health?: HealthResult
  confidence: number // 0-1，解析置信度
}

export type PeriodKind = 'day' | 'week' | 'month' | 'quarter' | 'half' | 'year'
