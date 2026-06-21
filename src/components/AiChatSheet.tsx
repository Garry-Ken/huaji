import { useCallback, useEffect, useRef, useState } from 'react'
import type { Expense } from '../types'
import { useEntitlement } from '../lib/entitlement'
import { sendChatMessage, buildDietContext, type ChatMessage } from '../lib/aiChat'
import { getTokenUsage, canChat } from '../lib/tokenTracker'
import { XIcon, SparkIcon } from './icons'

const QUICK_QUESTIONS = [
  '这周吃得健康吗？',
  '帮我规划明天三餐',
  '哪些饮食习惯需要改？',
  '推荐一些健康零食',
]

interface Msg {
  role: 'user' | 'assistant'
  content: string
}

export function AiChatSheet({ expenses, onClose }: { expenses: Expense[]; onClose: () => void }) {
  const { canDietChat, isAdmin, openPaywall } = useEntitlement()
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const dietContext = buildDietContext(expenses)
  const tokenUsage = getTokenUsage()

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const send = useCallback(async (text: string) => {
    if (!text.trim() || loading) return

    if (!canDietChat) {
      openPaywall('AI 饮食对话：升级 Ultra，或在「我的」填自己的 API key 免费用')
      return
    }
    if (!canChat() && !isAdmin) return // 店主不受月度 token 上限

    const userMsg: Msg = { role: 'user', content: text.trim() }
    const next = [...messages, userMsg]
    setMessages(next)
    setInput('')
    setLoading(true)

    const apiMessages: ChatMessage[] = next.map(m => ({ role: m.role, content: m.content }))
    const res = await sendChatMessage(apiMessages, dietContext)

    if ('error' in res) {
      setMessages(prev => [...prev, { role: 'assistant', content: `抱歉，出错了：${res.error}` }])
    } else {
      setMessages(prev => [...prev, { role: 'assistant', content: res.content }])
    }
    setLoading(false)
  }, [messages, loading, canDietChat, isAdmin, openPaywall, dietContext])

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[#f5f5f7] dark:bg-[#1c1c1e]">
      {/* 头部 */}
      <div className="glass border-b border-[#00000010] dark:border-[#ffffff12] safe-top">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <button onClick={onClose} className="btn-ghost !p-2 !rounded-full"><XIcon size={18} /></button>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white shrink-0" style={{ background: 'linear-gradient(135deg,#af52de,#ff375f)' }}>
            <SparkIcon size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-[15px]">AI 营养师</div>
            <div className="text-[11px] text-[#86868b]">基于你的饮食数据</div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[10px] text-[#86868b]">本月 token</div>
            <div className="flex items-center gap-1.5">
              <div className="w-12 h-1.5 rounded-full bg-[#00000010] dark:bg-[#ffffff14] overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{
                  width: `${tokenUsage.percent}%`,
                  background: tokenUsage.percent > 80 ? '#ff3b30' : tokenUsage.percent > 50 ? '#ff9f0a' : '#30d158',
                }} />
              </div>
              <span className="text-[10px] text-[#86868b] tabular-nums">{Math.round(tokenUsage.percent)}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* 消息区 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">
          {messages.length === 0 && (
            <div className="text-center py-8">
              <div className="text-[40px] mb-3">🥗</div>
              <div className="text-[15px] font-medium mb-1">你的 AI 营养师</div>
              <div className="text-[13px] text-[#86868b] mb-6">基于你的真实饮食记录，给出个性化建议</div>
              <div className="flex flex-wrap justify-center gap-2">
                {QUICK_QUESTIONS.map(q => (
                  <button key={q} onClick={() => send(q)} className="btn-ghost text-[13px] !bg-white dark:!bg-[#2c2c2e] !shadow-sm">
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed ${
                m.role === 'user'
                  ? 'bg-[#0a84ff] text-white rounded-br-md'
                  : 'bg-white dark:bg-[#2c2c2e] rounded-bl-md shadow-sm'
              }`}>
                <div className="whitespace-pre-wrap">{m.content}</div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-white dark:bg-[#2c2c2e] rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                <div className="flex gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#86868b] animate-pulse" />
                  <span className="w-2 h-2 rounded-full bg-[#86868b] animate-pulse" style={{ animationDelay: '0.2s' }} />
                  <span className="w-2 h-2 rounded-full bg-[#86868b] animate-pulse" style={{ animationDelay: '0.4s' }} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 输入栏 */}
      <div className="glass border-t border-[#00000010] dark:border-[#ffffff12] safe-bottom">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) send(input) }}
            placeholder="问问 AI 营养师…"
            className="flex-1 rounded-2xl bg-[#e5e5ea] dark:bg-[#3a3a3c] px-4 py-2.5 text-[15px] outline-none"
            disabled={loading}
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || loading}
            className="w-9 h-9 rounded-full flex items-center justify-center text-white shrink-0 disabled:opacity-40 transition-opacity"
            style={{ background: 'linear-gradient(135deg,#af52de,#ff375f)' }}
          >
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>
    </div>
  )
}
