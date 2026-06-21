import type { ParseResult } from '../types'
import type { CategoryId } from '../types'
import { callAi } from './aiConfig'

const VALID_CATEGORIES = new Set<string>([
  'food', 'transport', 'shopping', 'entertainment', 'housing',
  'medical', 'education', 'communication', 'social', 'income', 'other',
])

const SYSTEM_PROMPT = `你是花迹记账App的AI助手。用户会输入一段中文文本描述消费/收入，以及本地解析器的初步结果。
请复核并优化解析结果，纠正分类、金额、标题等错误。

可用分类：food(餐饮) transport(交通) shopping(购物) entertainment(娱乐) housing(住房) medical(医疗) education(教育) communication(通讯) social(人情社交) income(收入) other(其他)

返回JSON数组，每个元素：
{"title":"简短标题","amount":数字或null,"category":"分类id","type":"expense或income","items":["明细"],"merchant":"商家","location":"地点","meal":"breakfast/lunch/dinner/snack或null"}

仅返回JSON，不要其他文字。`

export async function aiEnhanceParse(rawText: string, localResults: ParseResult[]): Promise<ParseResult[] | null> {
  const localSummary = localResults.map(r => ({
    title: r.title, amount: r.amount, category: r.category, type: r.type,
  }))

  try {
    const res = await callAi({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `原文：${rawText}\n\n本地解析结果：${JSON.stringify(localSummary)}` },
      ],
      temperature: 0.1,
      max_tokens: 1024,
    })
    if ('error' in res) return null
    const content = res.content
    if (!content) return null

    const jsonStr = content.replace(/^```json?\s*/i, '').replace(/```\s*$/, '')
    const arr = JSON.parse(jsonStr)
    if (!Array.isArray(arr)) return null

    return arr.map((item: Record<string, unknown>, i: number) => {
      const base = localResults[i] ?? localResults[0]
      return {
        ...base,
        title: typeof item.title === 'string' ? item.title : base.title,
        amount: typeof item.amount === 'number' ? item.amount : base.amount,
        category: VALID_CATEGORIES.has(item.category as string) ? (item.category as CategoryId) : base.category,
        type: item.type === 'income' ? 'income' as const : 'expense' as const,
        items: Array.isArray(item.items) ? item.items.filter((x: unknown) => typeof x === 'string') : base.items,
        merchant: typeof item.merchant === 'string' && item.merchant ? item.merchant : base.merchant,
        location: typeof item.location === 'string' && item.location ? item.location : base.location,
        meal: ['breakfast', 'lunch', 'dinner', 'snack'].includes(item.meal as string) ? (item.meal as ParseResult['meal']) : base.meal,
      }
    })
  } catch {
    return null
  }
}
