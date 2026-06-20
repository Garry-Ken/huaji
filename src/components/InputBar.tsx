import { useEffect, useMemo, useRef, useState } from 'react'
import type { InputSource, ParseResult } from '../types'
import { parseMultiExpense } from '../lib/parser'
import { aiEnhanceParse } from '../lib/ai'
import { useEntitlement } from '../lib/entitlement'
import { yuan, relativeDay, timeShort } from '../lib/format'
import { categoryMeta } from '../lib/categories'
import { CategoryTag, MealTag, HealthLevelTag } from './bits'
import { MicIcon, ClipboardIcon, SparkIcon, MapPinIcon, ClockIcon } from './icons'
import { speechSupported, createRecognizer, type Recognizer } from '../lib/speech'

const EXAMPLES = ['中午公司楼下吃麻辣烫 28', '打车回家 35', '下午一杯奶茶 18', '晚上和朋友火锅 158', '淘宝买了件外套 299']

export function InputBar({ onAdd }: { onAdd: (raw: string, source: InputSource) => void }) {
  const [text, setText] = useState('')
  const [interim, setInterim] = useState('')
  const [listening, setListening] = useState(false)
  const [source, setSource] = useState<InputSource>('text')
  const [aiResults, setAiResults] = useState<ParseResult[] | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const recRef = useRef<Recognizer | null>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const aiSeq = useRef(0)
  const { aiEnhance, isPro } = useEntitlement()

  const display = text + interim
  const localPreviews = useMemo(() => (display.trim() ? parseMultiExpense(display) : []), [display])
  const previews = aiResults ?? localPreviews

  useEffect(() => {
    const raw = display.trim()
    if (!raw || !aiEnhance || !isPro || localPreviews.length === 0) { setAiResults(null); return }
    const seq = ++aiSeq.current
    setAiLoading(true)
    const timer = setTimeout(async () => {
      const result = await aiEnhanceParse(raw, localPreviews)
      if (aiSeq.current === seq) { setAiResults(result); setAiLoading(false) }
    }, 800)
    return () => { clearTimeout(timer); if (aiSeq.current === seq) setAiLoading(false) }
  }, [display, aiEnhance, isPro]) // eslint-disable-line react-hooks/exhaustive-deps

  const commit = () => {
    const raw = display.trim()
    if (!raw) return
    onAdd(raw, source)
    setText('')
    setInterim('')
    setSource('text')
    setAiResults(null)
    taRef.current?.focus()
  }

  const toggleMic = () => {
    if (listening) {
      recRef.current?.stop()
      return
    }
    if (!recRef.current) {
      recRef.current = createRecognizer({
        onResult: (t, isFinal) => {
          if (isFinal) {
            setText((prev) => (prev ? prev + ' ' : '') + t)
            setInterim('')
            setSource('voice')
          } else {
            setInterim(t)
          }
        },
        onEnd: () => { setListening(false); setInterim('') },
        onError: () => { setListening(false); setInterim('') },
      })
    }
    if (recRef.current) {
      setListening(true)
      setSource('voice')
      recRef.current.start()
    }
  }

  const paste = async () => {
    try {
      const t = await navigator.clipboard.readText()
      if (t) {
        setText((prev) => (prev ? prev + ' ' : '') + t.trim())
        setSource('paste')
      }
    } catch {
      taRef.current?.focus() // 无剪贴板权限时退回手动粘贴
    }
    taRef.current?.focus()
  }

  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-2.5">
        <span className="text-[#0a84ff]"><SparkIcon size={18} /></span>
        <h2 className="text-[15px] font-semibold">记一笔</h2>
        <span className="text-[12px] text-[#86868b]">说一句话，自动结构化 · 分类 · 健康分析</span>
      </div>

      <textarea
        ref={taRef}
        value={display}
        onChange={(e) => { setText(e.target.value); setInterim(''); setSource('text') }}
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); commit() } }}
        rows={2}
        placeholder="例如：中午在公司楼下吃了麻辣烫，花了 28 元"
        className="input-bare text-[16px] leading-relaxed min-h-[52px]"
      />

      {/* 实时解析预览 */}
      {aiLoading && previews.length > 0 && (
        <div className="mt-2 flex items-center gap-1.5 text-[12px] text-[#0a84ff]">
          <SparkIcon size={13} className="animate-pulse" />
          <span>AI 优化中…</span>
        </div>
      )}
      {previews.length === 1 && (() => {
        const preview = previews[0]
        return (
          <div className="mt-2 rounded-2xl bg-[#f5f5f7] dark:bg-[#2c2c2e]/60 p-3 animate-pop">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              {aiResults && <span className="text-[10px] text-[#0a84ff] bg-[#0a84ff]/10 rounded-full px-2 py-0.5 font-medium">AI</span>}
              <div className="flex items-baseline gap-1">
                {preview.amount != null ? (
                  <>
                    <span className={`text-[13px] ${preview.type === 'income' ? 'text-[#30d158]' : 'text-[#86868b]'}`}>{preview.type === 'income' ? '+¥' : '¥'}</span>
                    <span className={`text-[26px] font-semibold tracking-tight ${preview.type === 'income' ? 'text-[#30d158]' : ''}`}>{yuan(preview.amount).slice(1)}</span>
                  </>
                ) : (
                  <span className="text-[15px] text-[#ff9f0a] font-medium">未识别到金额 · 可记账后补填</span>
                )}
              </div>
              <CategoryTag id={preview.category} />
            </div>
            <div className="flex items-center gap-x-3 gap-y-1.5 flex-wrap mt-2 text-[12px] text-[#636366] dark:text-[#aeaeb2]">
              <span className="inline-flex items-center gap-1"><ClockIcon size={13} />{relativeDay(preview.occurredAt)} {timeShort(preview.occurredAt)}</span>
              {preview.location && <span className="inline-flex items-center gap-1"><MapPinIcon size={13} />{preview.location}</span>}
              {preview.merchant && <span>· {preview.merchant}</span>}
              {preview.meal && <MealTag meal={preview.meal} />}
              {preview.items.length > 0 && <span className="text-[#86868b]">{preview.items.join('、')}</span>}
              {preview.health && <HealthLevelTag score={preview.health.score} />}
            </div>
            {preview.health && preview.health.suggestions[0] && (
              <div className="mt-2 text-[12px] text-[#0a84ff] flex items-start gap-1">
                <SparkIcon size={13} className="mt-0.5 shrink-0" />
                <span>{preview.health.suggestions[0]}</span>
              </div>
            )}
          </div>
        )
      })()}
      {previews.length > 1 && (
        <div className="mt-2 rounded-2xl bg-[#f5f5f7] dark:bg-[#2c2c2e]/60 p-3 animate-pop">
          <div className="text-[12px] text-[#86868b] mb-2">识别到 {previews.length} 笔记录</div>
          <div className="space-y-1.5">
            {previews.map((p, i) => {
              const cat = categoryMeta(p.category)
              return (
                <div key={i} className="flex items-center gap-2 text-[14px]">
                  <span>{cat.emoji}</span>
                  <span className="text-[13px]" style={{ color: cat.color }}>{cat.label}</span>
                  {p.meal && <MealTag meal={p.meal} />}
                  <span className="flex-1" />
                  <span className={`font-semibold tabular-nums ${p.type === 'income' ? 'text-[#30d158]' : ''}`}>
                    {p.amount != null ? (p.type === 'income' ? '+' : '') + yuan(p.amount) : '—'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 空状态示例 */}
      {!display.trim() && (
        <div className="mt-2.5 flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => { setText(ex); setSource('text'); taRef.current?.focus() }}
              className="pill bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#636366] dark:text-[#aeaeb2] whitespace-nowrap hover:bg-[#e5e5ea] dark:hover:bg-[#3a3a3c] shrink-0"
            >
              {ex}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 mt-3">
        {speechSupported() && (
          <button
            onClick={toggleMic}
            className={`btn-ghost !px-3 ${listening ? '!bg-[#ff3b30] !text-white animate-mic' : ''}`}
            title="语音输入"
          >
            <MicIcon size={18} />
            <span className="hidden sm:inline">{listening ? '聆听中…' : '语音'}</span>
          </button>
        )}
        <button onClick={paste} className="btn-ghost !px-3" title="粘贴">
          <ClipboardIcon size={18} />
          <span className="hidden sm:inline">粘贴</span>
        </button>
        <div className="flex-1" />
        <button onClick={commit} disabled={!display.trim()} className="btn-primary">
          <SparkIcon size={17} />
          记一笔
        </button>
      </div>
    </div>
  )
}
