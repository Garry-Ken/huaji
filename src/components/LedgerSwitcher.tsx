import { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import type { Ledger, Expense } from '../types'
import { uid } from '../lib/storage'
import { useEntitlement } from '../lib/entitlement'
import { LEDGER_TEMPLATES, type LedgerTemplate } from '../lib/ledgerTemplates'

interface Props {
  ledgers: Ledger[]
  activeLedgerId: string
  defaultLedger: Ledger
  expenses: Expense[]
  onSwitch: (id: string) => void
  onAdd: (ledger: Ledger) => void
  onUpdate: (ledger: Ledger) => void
  onDelete: (id: string) => void
}

const EMOJI_OPTIONS = ['📒', '✈️', '🏠', '💼', '🎓', '🎮', '❤️', '🎯', '🛒', '📊', '🎁', '📈']

type Step = 'list' | 'templates' | 'customize' | 'edit'

export function LedgerSwitcher({ ledgers, activeLedgerId, defaultLedger, expenses, onSwitch, onAdd, onUpdate, onDelete }: Props) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>('list')
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('📒')
  const [description, setDescription] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState<LedgerTemplate | null>(null)
  const [editingLedger, setEditingLedger] = useState<Ledger | null>(null)
  const { isPlus, openPaywall } = useEntitlement()

  const allLedgers = [defaultLedger, ...ledgers]
  const active = allLedgers.find(l => l.id === activeLedgerId) ?? defaultLedger

  const ledgerStats = useMemo(() => {
    const map = new Map<string, { income: number; expense: number; count: number }>()
    for (const e of expenses) {
      const lid = e.ledgerId || 'default'
      const s = map.get(lid) ?? { income: 0, expense: 0, count: 0 }
      s.count++
      if (e.type === 'income') s.income += e.amount
      else s.expense += e.amount
      map.set(lid, s)
    }
    return map
  }, [expenses])

  const close = () => { setOpen(false); setStep('list'); setEditingLedger(null) }

  const handleAdd = () => {
    if (!isPlus) { openPaywall('创建多账本是 Plus 功能'); return }
    setStep('templates')
  }

  const pickTemplate = (t: LedgerTemplate) => {
    setSelectedTemplate(t)
    setName(t.name)
    setEmoji(t.emoji === '➕' ? '📒' : t.emoji)
    setDescription(t.description)
    setStep('customize')
  }

  const confirmAdd = () => {
    if (!name.trim()) return
    onAdd({
      id: uid(),
      name: name.trim(),
      emoji,
      createdAt: Date.now(),
      description: description.trim() || undefined,
      template: selectedTemplate?.id !== 'blank' ? selectedTemplate?.id : undefined,
      color: selectedTemplate?.color || undefined,
    })
    close()
  }

  const startEdit = (l: Ledger) => {
    setEditingLedger(l)
    setName(l.name)
    setEmoji(l.emoji)
    setDescription(l.description || '')
    setStep('edit')
  }

  const confirmEdit = () => {
    if (!editingLedger || !name.trim()) return
    onUpdate({ ...editingLedger, name: name.trim(), emoji, description: description.trim() || undefined })
    close()
  }

  const fmt = (n: number) => n >= 10000 ? `${(n / 10000).toFixed(1)}万` : n.toLocaleString('zh-CN')

  return (
    <>
      <button onClick={() => setOpen(true)} className="pill bg-[#f5f5f7] dark:bg-[#2c2c2e] text-[13px] font-medium gap-1">
        <span>{active.emoji}</span>
        <span>{active.name}</span>
        <svg width="10" height="10" viewBox="0 0 10 10" className="opacity-40"><path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" /></svg>
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={close}>
          <div className="absolute inset-0 bg-black/30 dark:bg-black/50" />
          <div className="relative w-full max-w-sm mx-4 mb-6 sm:mb-0 rounded-2xl bg-white dark:bg-[#1c1c1e] shadow-apple-lg overflow-hidden" onClick={e => e.stopPropagation()}>

            {/* ===== 列表视图 ===== */}
            {step === 'list' && <>
              <div className="px-5 pt-5 pb-3 text-[17px] font-semibold">切换账本</div>
              <div className="px-3 pb-2 max-h-[55vh] overflow-y-auto">
                {allLedgers.map(l => {
                  const s = ledgerStats.get(l.id)
                  return (
                    <div key={l.id} className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-[#f5f5f7] dark:hover:bg-[#2c2c2e] transition-colors">
                      <button className="flex-1 min-w-0 text-left" onClick={() => { onSwitch(l.id); close() }}>
                        <div className="flex items-center gap-3">
                          <span className="text-[22px]">{l.emoji}</span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[15px] font-medium truncate">{l.name}</span>
                              {l.id === activeLedgerId && <span className="text-[#0a84ff] text-[13px]">✓</span>}
                            </div>
                            {s && s.count > 0 && (
                              <div className="text-[11px] text-[#86868b] mt-0.5">
                                支 ¥{fmt(s.expense)}{s.income > 0 && <> · 收 ¥{fmt(s.income)}</>} · {s.count}笔
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                      {l.id !== 'default' && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => startEdit(l)} className="text-[#86868b] hover:text-[#0a84ff] p-1.5 rounded-lg transition-colors">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                            </svg>
                          </button>
                          <button onClick={() => { if (window.confirm(`删除账本「${l.name}」？其中的记录不会被删除。`)) onDelete(l.id) }}
                            className="text-[#86868b] hover:text-[#ff3b30] p-1.5 rounded-lg transition-colors">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              <div className="px-5 pb-5 pt-2">
                <button onClick={handleAdd} className="w-full py-3 rounded-xl border border-dashed border-[#00000020] dark:border-[#ffffff20] text-[14px] text-[#0a84ff] font-medium hover:bg-[#0a84ff]/5 transition-colors">
                  + 新建账本{!isPlus && ' 🔒'}
                </button>
              </div>
            </>}

            {/* ===== 模板选择 ===== */}
            {step === 'templates' && <>
              <div className="px-5 pt-5 pb-3 flex items-center gap-3">
                <button onClick={() => setStep('list')} className="text-[#0a84ff] text-[14px]">← 返回</button>
                <span className="text-[17px] font-semibold">选择模板</span>
              </div>
              <div className="px-5 pb-5 grid grid-cols-2 gap-3">
                {LEDGER_TEMPLATES.map(t => (
                  <button key={t.id} onClick={() => pickTemplate(t)}
                    className="flex flex-col items-center gap-2 p-4 rounded-2xl border border-[#00000010] dark:border-[#ffffff12] hover:bg-[#f5f5f7] dark:hover:bg-[#2c2c2e] transition-colors text-center">
                    <span className="text-[32px]">{t.emoji}</span>
                    <span className="text-[14px] font-medium">{t.id === 'blank' ? '空白账本' : t.name}</span>
                    <span className="text-[11px] text-[#86868b]">{t.subtitle}</span>
                  </button>
                ))}
              </div>
            </>}

            {/* ===== 自定义 / 编辑 ===== */}
            {(step === 'customize' || step === 'edit') && <>
              <div className="px-5 pt-5 pb-3 flex items-center gap-3">
                <button onClick={() => setStep(step === 'edit' ? 'list' : 'templates')} className="text-[#0a84ff] text-[14px]">← 返回</button>
                <span className="text-[17px] font-semibold">{step === 'edit' ? '编辑账本' : '新建账本'}</span>
              </div>
              <div className="px-5 pb-5 space-y-3">
                <div className="flex gap-2 flex-wrap">
                  {EMOJI_OPTIONS.map(e => (
                    <button key={e} onClick={() => setEmoji(e)}
                      className={`w-9 h-9 rounded-lg text-[20px] flex items-center justify-center transition-all ${emoji === e ? 'bg-[#0a84ff]/15 ring-2 ring-[#0a84ff]' : 'bg-[#f5f5f7] dark:bg-[#2c2c2e]'}`}>
                      {e}
                    </button>
                  ))}
                </div>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="账本名称"
                  className="w-full px-4 py-3 rounded-xl bg-[#f5f5f7] dark:bg-[#2c2c2e] text-[15px] outline-none focus:ring-2 ring-[#0a84ff]"
                  autoFocus maxLength={10}
                  onKeyDown={e => e.key === 'Enter' && (step === 'edit' ? confirmEdit() : confirmAdd())} />
                <input value={description} onChange={e => setDescription(e.target.value)} placeholder="用途说明（可选）"
                  className="w-full px-4 py-3 rounded-xl bg-[#f5f5f7] dark:bg-[#2c2c2e] text-[14px] text-[#86868b] outline-none focus:ring-2 ring-[#0a84ff]"
                  maxLength={30}
                  onKeyDown={e => e.key === 'Enter' && (step === 'edit' ? confirmEdit() : confirmAdd())} />
                <div className="flex gap-2">
                  <button onClick={close} className="flex-1 py-3 rounded-xl bg-[#f5f5f7] dark:bg-[#2c2c2e] text-[14px] font-medium">取消</button>
                  <button onClick={step === 'edit' ? confirmEdit : confirmAdd} disabled={!name.trim()}
                    className="flex-1 py-3 rounded-xl bg-[#0a84ff] text-white text-[14px] font-medium disabled:opacity-40">
                    {step === 'edit' ? '保存' : '创建'}
                  </button>
                </div>
              </div>
            </>}

          </div>
        </div>,
        document.body
      )}
    </>
  )
}
