import type { Expense } from '../types'
import { trackTokens } from './tokenTracker'
import { loadAiConfig } from './aiConfig'

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export function buildDietContext(expenses: Expense[]): string {
  const now = Date.now()
  const week = expenses.filter(e => e.occurredAt > now - 7 * 86400000 && e.category === 'food')
  if (week.length === 0) return '近7天无饮食记录'

  const meals = week.map(e => {
    const tags = e.health?.tags?.join('、') ?? ''
    const score = e.health?.score ?? '-'
    return `${new Date(e.occurredAt).toLocaleDateString('zh-CN')} ${e.meal ?? ''} ${e.title} ¥${e.amount} 健康分${score} ${tags}`
  })

  const avgScore = week.filter(e => e.health?.score).reduce((s, e) => s + (e.health?.score ?? 0), 0) / Math.max(1, week.filter(e => e.health?.score).length)
  const totalSpend = week.reduce((s, e) => s + e.amount, 0)

  return [
    `近7天饮食概览：${week.length}餐，总花费¥${Math.round(totalSpend)}，平均健康分${Math.round(avgScore)}/100`,
    '',
    ...meals,
  ].join('\n')
}

const SYSTEM_PROMPT = `你是花迹App的AI营养师。基于用户的真实饮食记录数据给出个性化建议。
请基于数据给出具体、可执行的饮食优化建议。不要泛泛而谈。
如果用户问的不是饮食相关问题，礼貌引导回饮食话题。
回答用中文，简洁友好，适当使用emoji。每次回答控制在300字以内。`

export async function sendChatMessage(
  messages: ChatMessage[],
  dietContext: string,
): Promise<{ content: string; tokens: number } | { error: string }> {
  const { apiKey, baseURL, model } = await loadAiConfig()
  if (!apiKey) return { error: 'AI 服务未配置' }

  const fullMessages: ChatMessage[] = [
    { role: 'system', content: `${SYSTEM_PROMPT}\n\n用户饮食数据：\n${dietContext}` },
    ...messages,
  ]

  try {
    const res = await fetch(baseURL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: fullMessages,
        temperature: 0.7,
        max_tokens: 1024,
      }),
    })

    if (!res.ok) return { error: `请求失败 (${res.status})` }
    const data = await res.json()
    const content = data.choices?.[0]?.message?.content?.trim()
    if (!content) return { error: '未收到回复' }

    const tokens = data.usage?.total_tokens ?? 0
    if (tokens > 0) trackTokens(tokens)

    return { content, tokens }
  } catch (e) {
    return { error: e instanceof Error ? e.message : '网络错误' }
  }
}
