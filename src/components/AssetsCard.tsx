import { useState } from 'react'
import type { AssetAccount } from '../types'
import { uid } from '../lib/storage'
import { yuan } from '../lib/format'

interface Props {
  accounts: AssetAccount[]
  onChange: (accounts: AssetAccount[]) => void
}

const PRESETS: { name: string; icon: string }[] = [
  { name: '现金', icon: '💵' },
  { name: '银行卡', icon: '🏦' },
  { name: '支付宝', icon: '📱' },
  { name: '微信', icon: '💬' },
]

export function AssetsCard({ accounts, onChange }: Props) {
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('💵')
  const [balance, setBalance] = useState('')

  const total = accounts.reduce((s, a) => s + a.balance, 0)

  const startAdd = (preset?: { name: string; icon: string }) => {
    setName(preset?.name ?? '')
    setIcon(preset?.icon ?? '💵')
    setBalance('')
    setEditing(null)
    setAdding(true)
  }

  const startEdit = (a: AssetAccount) => {
    setName(a.name)
    setIcon(a.icon)
    setBalance(String(a.balance))
    setEditing(a.id)
    setAdding(true)
  }

  const save = () => {
    const bal = parseFloat(balance) || 0
    if (!name.trim()) return
    if (editing) {
      onChange(accounts.map(a => a.id === editing ? { ...a, name: name.trim(), icon, balance: bal } : a))
    } else {
      onChange([...accounts, { id: uid(), name: name.trim(), icon, balance: bal, createdAt: Date.now() }])
    }
    setAdding(false)
    setEditing(null)
  }

  const remove = (id: string) => {
    if (!window.confirm('删除此账户？')) return
    onChange(accounts.filter(a => a.id !== id))
  }

  return (
    <section className="card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[15px] font-semibold">资产账户</h3>
        <span className={`text-[15px] font-semibold tabular-nums ${total >= 0 ? 'text-[#30d158]' : 'text-[#ff3b30]'}`}>
          总计 {yuan(Math.abs(total))}
        </span>
      </div>

      {accounts.length > 0 && (
        <div className="space-y-0 divide-y divide-[#00000008] dark:divide-[#ffffff08] mb-3">
          {accounts.map(a => (
            <div key={a.id} className="flex items-center gap-3 py-3">
              <span className="text-[20px]">{a.icon}</span>
              <span className="flex-1 text-[14px] font-medium">{a.name}</span>
              <span className="text-[14px] font-semibold tabular-nums">{yuan(a.balance)}</span>
              <button onClick={() => startEdit(a)} className="text-[12px] text-[#0a84ff] px-2 py-1">编辑</button>
              <button onClick={() => remove(a.id)} className="text-[12px] text-[#86868b] hover:text-[#ff3b30] px-1 py-1">×</button>
            </div>
          ))}
        </div>
      )}

      {!adding ? (
        <div>
          {accounts.length === 0 && (
            <div className="flex gap-2 mb-3">
              {PRESETS.map(p => (
                <button key={p.name} onClick={() => startAdd(p)}
                  className="flex-1 py-2.5 rounded-xl bg-[#f5f5f7] dark:bg-[#2c2c2e] text-[13px] font-medium hover:bg-[#0a84ff]/10 transition-colors">
                  {p.icon} {p.name}
                </button>
              ))}
            </div>
          )}
          <button onClick={() => startAdd()} className="w-full py-2.5 rounded-xl border border-dashed border-[#00000015] dark:border-[#ffffff15] text-[13px] text-[#0a84ff] font-medium hover:bg-[#0a84ff]/5 transition-colors">
            + 添加账户
          </button>
        </div>
      ) : (
        <div className="space-y-3 pt-2">
          <div className="flex gap-2">
            {['💵', '🏦', '📱', '💬', '💳', '🏧', '🪙', '📊'].map(e => (
              <button key={e} onClick={() => setIcon(e)}
                className={`w-8 h-8 rounded-lg text-[18px] flex items-center justify-center ${icon === e ? 'bg-[#0a84ff]/15 ring-2 ring-[#0a84ff]' : 'bg-[#f5f5f7] dark:bg-[#2c2c2e]'}`}>
                {e}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={name} onChange={e => setName(e.target.value)} placeholder="账户名称"
              className="flex-1 px-3 py-2.5 rounded-xl bg-[#f5f5f7] dark:bg-[#2c2c2e] text-[14px] outline-none focus:ring-2 ring-[#0a84ff]"
              maxLength={10} />
            <input value={balance} onChange={e => setBalance(e.target.value)} placeholder="余额" type="number"
              className="w-28 px-3 py-2.5 rounded-xl bg-[#f5f5f7] dark:bg-[#2c2c2e] text-[14px] outline-none focus:ring-2 ring-[#0a84ff] tabular-nums" />
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setAdding(false); setEditing(null) }} className="flex-1 py-2.5 rounded-xl bg-[#f5f5f7] dark:bg-[#2c2c2e] text-[13px] font-medium">取消</button>
            <button onClick={save} disabled={!name.trim()} className="flex-1 py-2.5 rounded-xl bg-[#0a84ff] text-white text-[13px] font-medium disabled:opacity-40">{editing ? '保存' : '添加'}</button>
          </div>
        </div>
      )}
    </section>
  )
}
