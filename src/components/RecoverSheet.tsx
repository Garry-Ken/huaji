import { useCallback, useEffect, useState } from 'react'
import type { Expense } from '../types'
import { useEntitlement } from '../lib/entitlement'
import { checkQuota, useQuota } from '../lib/quota'
import { pullDeletedFromCloud, restoreFromCloud } from '../lib/sync'
import { categoryMeta } from '../lib/categories'
import { yuan } from '../lib/format'
import { XIcon, CheckIcon, RefreshIcon } from './icons'

export function RecoverSheet({ onClose, onRecover, onToast }: {
  onClose: () => void
  onRecover: (records: Expense[]) => void
  onToast: (msg: string) => void
}) {
  const { tier } = useEntitlement()
  const [records, setRecords] = useState<Expense[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    pullDeletedFromCloud().then(res => {
      setLoading(false)
      if (res.ok) setRecords(res.records)
      else onToast(res.msg)
    })
  }, [onToast])

  const toggle = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }, [])

  const selectAll = () => setSelected(new Set(records.map(r => r.id)))

  const doRecover = async () => {
    if (selected.size === 0 || busy) return
    if (!tier) return
    const q = checkQuota('recover', tier)
    if (!q.allowed) {
      onToast(`本月恢复次数已用完 (${q.used}/${q.limit})`)
      return
    }
    setBusy(true)
    const ids = [...selected]
    const res = await restoreFromCloud(ids)
    if (res.ok) {
      useQuota('recover')
      const restored = records.filter(r => selected.has(r.id))
      onRecover(restored)
      setRecords(prev => prev.filter(r => !selected.has(r.id)))
      setSelected(new Set())
      onToast(`已恢复 ${ids.length} 条记录`)
    } else {
      onToast(res.msg)
    }
    setBusy(false)
  }

  const quota = tier ? checkQuota('recover', tier) : null

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md card !rounded-t-3xl sm:!rounded-3xl rounded-b-none p-6 animate-pop safe-bottom max-h-[85vh] flex flex-col">
        <button onClick={onClose} className="absolute right-4 top-4 btn-ghost !p-2 !rounded-full z-10"><XIcon size={18} /></button>

        <div className="flex items-center gap-3 mb-1">
          <RefreshIcon size={22} className="text-[#0a84ff]" />
          <h2 className="text-[17px] font-semibold">云端恢复</h2>
        </div>
        {quota && quota.limit !== Infinity && (
          <p className="text-[12px] text-[#86868b] mb-3">本月已用 {quota.used}/{quota.limit} 次</p>
        )}

        <div className="flex-1 overflow-y-auto -mx-2 px-2 min-h-0">
          {loading ? (
            <div className="text-center text-[#86868b] py-10">加载中…</div>
          ) : records.length === 0 ? (
            <div className="text-center text-[#86868b] py-10">
              <div className="text-[32px] mb-2">🗑️</div>
              <div>云端没有已删除的记录</div>
            </div>
          ) : (
            <div className="space-y-1">
              {records.map(r => {
                const m = categoryMeta(r.category)
                const sel = selected.has(r.id)
                return (
                  <button key={r.id} onClick={() => toggle(r.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[#f5f5f7] dark:hover:bg-[#2c2c2e]/50 text-left transition-colors"
                  >
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${sel ? 'border-[#0a84ff] bg-[#0a84ff]' : 'border-[#c7c7cc] dark:border-[#48484a]'}`}>
                      {sel && <CheckIcon size={13} className="text-white" />}
                    </div>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-[15px] shrink-0" style={{ background: m.color + '1f' }}>
                      {m.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-medium truncate">{r.title || m.label}</div>
                      <div className="text-[11px] text-[#86868b]">{new Date(r.occurredAt).toLocaleDateString('zh-CN')}</div>
                    </div>
                    <span className="text-[15px] font-semibold tabular-nums shrink-0">{yuan(r.amount)}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {records.length > 0 && (
          <div className="flex items-center gap-2 mt-4 pt-3 border-t border-[#00000008] dark:border-[#ffffff0d]">
            <button onClick={selectAll} className="btn-ghost text-[13px]">全选</button>
            <span className="flex-1 text-center text-[13px] text-[#86868b]">已选 {selected.size} 项</span>
            <button onClick={doRecover} disabled={selected.size === 0 || busy}
              className="btn-primary !px-4 text-[13px] disabled:opacity-40"
            >
              {busy ? '恢复中…' : '恢复'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
