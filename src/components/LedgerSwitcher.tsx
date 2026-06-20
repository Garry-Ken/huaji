import { useState } from 'react'
import type { Ledger } from '../types'
import { uid } from '../lib/storage'
import { useEntitlement } from '../lib/entitlement'

interface Props {
  ledgers: Ledger[]
  activeLedgerId: string
  defaultLedger: Ledger
  onSwitch: (id: string) => void
  onAdd: (ledger: Ledger) => void
  onDelete: (id: string) => void
}

const EMOJI_OPTIONS = ['📒', '✈️', '🏠', '💼', '🎓', '🎮', '❤️', '🎯', '🛒', '📊', '🐱', '🌟']

export function LedgerSwitcher({ ledgers, activeLedgerId, defaultLedger, onSwitch, onAdd, onDelete }: Props) {
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('📒')
  const { isPro, openPaywall } = useEntitlement()

  const allLedgers = [defaultLedger, ...ledgers]
  const active = allLedgers.find(l => l.id === activeLedgerId) ?? defaultLedger

  const handleAdd = () => {
    if (!isPro) { openPaywall('创建多账本是 Pro 功能'); return }
    setCreating(true)
    setName('')
    setEmoji('📒')
  }

  const confirmAdd = () => {
    if (!name.trim()) return
    onAdd({ id: uid(), name: name.trim(), emoji, createdAt: Date.now() })
    setCreating(false)
    setOpen(false)
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="pill bg-[#f5f5f7] dark:bg-[#2c2c2e] text-[13px] font-medium gap-1">
        <span>{active.emoji}</span>
        <span>{active.name}</span>
        <svg width="10" height="10" viewBox="0 0 10 10" className="opacity-40"><path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" /></svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={() => { setOpen(false); setCreating(false) }}>
          <div className="absolute inset-0 bg-black/30 dark:bg-black/50" />
          <div className="relative w-full max-w-sm mx-4 mb-6 sm:mb-0 rounded-2xl bg-white dark:bg-[#1c1c1e] shadow-apple-lg overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-5 pt-5 pb-3 text-[17px] font-semibold">切换账本</div>

            <div className="px-3 pb-2 max-h-[50vh] overflow-y-auto">
              {allLedgers.map(l => (
                <div key={l.id} className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-[#f5f5f7] dark:hover:bg-[#2c2c2e] transition-colors">
                  <button className="flex-1 flex items-center gap-3 text-left" onClick={() => { onSwitch(l.id); setOpen(false) }}>
                    <span className="text-[22px]">{l.emoji}</span>
                    <span className="text-[15px] font-medium">{l.name}</span>
                    {l.id === activeLedgerId && <span className="text-[#0a84ff] text-[13px]">✓</span>}
                  </button>
                  {l.id !== 'default' && (
                    <button onClick={() => { if (window.confirm(`删除账本「${l.name}」？其中的记录不会被删除。`)) onDelete(l.id) }}
                      className="text-[#86868b] hover:text-[#ff3b30] text-[13px] px-2 py-1 rounded-lg transition-colors">
                      删除
                    </button>
                  )}
                </div>
              ))}
            </div>

            {!creating ? (
              <div className="px-5 pb-5 pt-2">
                <button onClick={handleAdd} className="w-full py-3 rounded-xl border border-dashed border-[#00000020] dark:border-[#ffffff20] text-[14px] text-[#0a84ff] font-medium hover:bg-[#0a84ff]/5 transition-colors">
                  + 新建账本{!isPro && ' 🔒'}
                </button>
              </div>
            ) : (
              <div className="px-5 pb-5 pt-2 space-y-3">
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
                  onKeyDown={e => e.key === 'Enter' && confirmAdd()} />
                <div className="flex gap-2">
                  <button onClick={() => setCreating(false)} className="flex-1 py-3 rounded-xl bg-[#f5f5f7] dark:bg-[#2c2c2e] text-[14px] font-medium">取消</button>
                  <button onClick={confirmAdd} disabled={!name.trim()} className="flex-1 py-3 rounded-xl bg-[#0a84ff] text-white text-[14px] font-medium disabled:opacity-40">创建</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
