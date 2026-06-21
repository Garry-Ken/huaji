// ---- 核心数据模型 ----

export type TransactionType = 'expense' | 'income'

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
  | 'income'
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

/** 一笔收支记录 */
export interface Expense {
  id: string
  type: TransactionType
  amount: number // 金额（元，始终正数）
  category: CategoryId
  title: string // 简短标题，如 "麻辣烫"
  items: string[] // 明细项（饮食类尤其有用）
  quantity?: string // 容量/数量，如 "一桶5升" "一瓶"（单品时列表小字展示）
  merchant?: string // 商家 / 品牌
  location?: string // 地点
  note?: string
  occurredAt: number // 消费实际发生时间(ms)，由解析推断
  createdAt: number // 原始录入时间(ms)
  updatedAt?: number // 最后修改时间(ms)，用于多端同步冲突解决(后写赢)
  source: InputSource
  rawText: string // 原始输入文本
  meal?: MealType // 餐次（饮食类）
  health?: HealthResult // 饮食健康分析（饮食类）
  ledgerId?: string // 所属账本，undefined = 'default'
  counterparty?: string // 借贷对方
  isDebt?: boolean // 是否为借贷记录
}

/** 解析器产出（写入存储前的草稿） */
export interface ParseResult {
  type: TransactionType
  amount: number | null
  category: CategoryId
  title: string
  items: string[]
  quantity?: string
  merchant?: string
  location?: string
  occurredAt: number
  meal?: MealType
  health?: HealthResult
  confidence: number // 0-1，解析置信度
  counterparty?: string
  isDebt?: boolean
}

export type PeriodKind = 'day' | 'week' | 'month' | 'quarter' | 'half' | 'year'

/** 账本 */
export interface Ledger {
  id: string
  name: string
  emoji: string
  createdAt: number
  updatedAt?: number // 最后修改时间(ms)，多端同步冲突解决
  description?: string
  template?: string
  color?: string
}

/** 资产账户 */
export interface AssetAccount {
  id: string
  name: string
  icon: string
  balance: number
  createdAt: number
}
