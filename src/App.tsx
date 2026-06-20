import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { AssetAccount, Expense, InputSource, Ledger } from './types'
import { parseMultiExpense } from './lib/parser'
import { load, persist, makeExpense, sortByTime, hasSeeded, markSeeded, uid, hasSampleFlag, setSampleFlag, clearSampleFlag, loadBudget, DEFAULT_LEDGER, loadLedgers, persistLedgers, loadAccounts, persistAccounts } from './lib/storage'
import { generateSample } from './lib/sampleData'
import { RecordsView } from './components/RecordsView'
import { Dashboard } from './components/Dashboard'
import { HealthPanel } from './components/HealthPanel'
import { AccountView } from './components/AccountView'
import { EditSheet } from './components/EditSheet'
import { Paywall } from './components/Paywall'
import { LoginSheet } from './components/LoginSheet'
import { PasswordResetSheet } from './components/PasswordResetSheet'
import { LedgerSwitcher } from './components/LedgerSwitcher'
import { useEntitlement } from './lib/entitlement'
import { WalletIcon, PieIcon, HealthIcon, UserIcon, CrownIcon, SunIcon, MoonIcon, PlusIcon, CheckIcon } from './components/icons'

type Tab = 'records' | 'stats' | 'health' | 'account'

const TABS: { id: Tab; label: string; icon: (p: { size?: number }) => ReactNode }[] = [
  { id: 'records', label: '记账', icon: WalletIcon },
  { id: 'stats', label: '统计', icon: PieIcon },
  { id: 'health', label: '健康', icon: HealthIcon },
  { id: 'account', label: '我的', icon: UserIcon },
]

export default function App() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [tab, setTab] = useState<Tab>('records')
  const [editing, setEditing] = useState<Expense | null>(null)
  const [editingNew, setEditingNew] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [dark, setDark] = useState(false)
  const [sampleMode, setSampleMode] = useState(hasSampleFlag())
  const [ledgers, setLedgers] = useState<Ledger[]>([])
  const [activeLedgerId, setActiveLedgerId] = useState('default')
  const [accounts, setAccounts] = useState<AssetAccount[]>([])
  const { status, daysLeft, openPaywall } = useEntitlement()

  // 初始化：主题 + 数据（首次注入示例）
  useEffect(() => {
    const saved = localStorage.getItem('huaji.theme')
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches
    setDark(saved ? saved === 'dark' : !!prefersDark)

    let data = load()
    if (import.meta.env.DEV && data.length === 0 && !hasSeeded()) {
      data = generateSample()
      persist(data)
      markSeeded()
    }
    setExpenses(sortByTime(data))
    setLedgers(loadLedgers())
    setAccounts(loadAccounts())
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('huaji.theme', dark ? 'dark' : 'light')
  }, [dark])

  const showToast = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 1800)
  }

  const update = (next: Expense[]) => {
    const sorted = sortByTime(next)
    setExpenses(sorted)
    persist(sorted)
  }

  // 按需载入示例数据（空表时“看看效果”入口）
  const loadSample = () => {
    const data = sortByTime(generateSample())
    setExpenses(data)
    persist(data)
    setSampleFlag()
    setSampleMode(true)
    showToast('已载入示例数据')
  }

  // 清空全部记录（示例提示条 / 管理员面板共用）
  const clearAllData = () => {
    if (!window.confirm('确定清空全部记录？此操作不可撤销。')) return
    setExpenses([])
    persist([])
    clearSampleFlag()
    setSampleMode(false)
    showToast('已清空全部记录')
  }

  const updateLedgers = useCallback((next: Ledger[]) => { setLedgers(next); persistLedgers(next) }, [])
  const updateAccounts = useCallback((next: AssetAccount[]) => { setAccounts(next); persistAccounts(next) }, [])

  const addLedger = useCallback((l: Ledger) => { updateLedgers([...ledgers, l]); setActiveLedgerId(l.id) }, [ledgers, updateLedgers])
  const deleteLedger = useCallback((id: string) => {
    updateLedgers(ledgers.filter(l => l.id !== id))
    if (activeLedgerId === id) setActiveLedgerId('default')
  }, [ledgers, activeLedgerId, updateLedgers])

  const filteredExpenses = useMemo(() => {
    if (activeLedgerId === 'default') return expenses.filter(e => !e.ledgerId || e.ledgerId === 'default')
    return expenses.filter(e => e.ledgerId === activeLedgerId)
  }, [expenses, activeLedgerId])

  const addFromText = (raw: string, source: InputSource) => {
    const results = parseMultiExpense(raw)
    const ledId = activeLedgerId !== 'default' ? activeLedgerId : undefined
    const newItems = results.map(p => makeExpense(p, raw, source, ledId))
    update([...newItems, ...expenses])
    if (results.length === 1) {
      showToast(results[0].amount != null ? '已记录 ✓' : '已记录 · 记得补填金额')
    } else {
      showToast(`已记录 ${results.length} 笔 ✓`)
    }
  }

  const saveEdit = (e: Expense) => {
    if (editingNew) update([e, ...expenses])
    else update(expenses.map((x) => (x.id === e.id ? e : x)))
    setEditing(null)
    setEditingNew(false)
    showToast('已保存 ✓')
  }

  const remove = (id: string) => {
    update(expenses.filter((x) => x.id !== id))
    setEditing(null)
    setEditingNew(false)
    showToast('已删除')
  }

  const openNew = () => {
    const now = Date.now()
    setEditing({ id: uid(), type: 'expense', amount: 0, category: 'other', title: '', items: [], occurredAt: now, createdAt: now, source: 'manual', rawText: '' })
    setEditingNew(true)
  }

  const total30 = useMemo(() => {
    const since = Date.now() - 30 * 86400000
    return expenses.filter((e) => e.occurredAt >= since && e.type !== 'income').reduce((s, e) => s + e.amount, 0)
  }, [expenses])

  const monthExpense = useMemo(() => {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
    return expenses.filter(e => e.occurredAt >= start && e.type !== 'income').reduce((s, e) => s + e.amount, 0)
  }, [expenses])

  const budget = loadBudget()

  return (
    <div className="min-h-full flex flex-col">
      {/* 顶栏 */}
      <header className="sticky top-0 z-30 glass border-b border-[#00000010] dark:border-[#ffffff12] safe-top">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <div className="w-8 h-8 rounded-[10px] flex items-center justify-center text-white shrink-0" style={{ background: 'linear-gradient(135deg,#0a84ff,#30d158)' }}>
            <WalletIcon size={18} />
          </div>
          <div className="leading-none">
            <div className="font-semibold text-[16px] flex items-center gap-2">花迹
              <LedgerSwitcher ledgers={ledgers} activeLedgerId={activeLedgerId} defaultLedger={DEFAULT_LEDGER} onSwitch={setActiveLedgerId} onAdd={addLedger} onDelete={deleteLedger} />
            </div>
            {budget ? (
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="w-16 h-1.5 rounded-full bg-[#00000010] dark:bg-[#ffffff14] overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, (monthExpense / budget) * 100)}%`, background: monthExpense > budget ? '#ff3b30' : monthExpense > budget * 0.8 ? '#ff9f0a' : '#30d158' }} />
                </div>
                <span className={`text-[11px] font-medium ${monthExpense > budget ? 'text-[#ff3b30]' : 'text-[#86868b]'}`}>
                  {Math.round((monthExpense / budget) * 100)}%
                </span>
              </div>
            ) : (
              <div className="text-[11px] text-[#86868b] mt-0.5">近30天 ¥{Math.round(total30).toLocaleString('zh-CN')}</div>
            )}
          </div>

          {/* 桌面端导航（包一层，避免 .seg 的 display:flex 覆盖 hidden） */}
          <div className="hidden sm:block ml-4">
            <nav className="seg">
              {TABS.map((t) => (
                <button key={t.id} onClick={() => setTab(t.id)} className={`seg-item inline-flex items-center gap-1.5 ${tab === t.id ? 'seg-item-active' : ''}`}>
                  <t.icon size={15} />{t.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="flex-1" />
          {/* 订阅状态药丸 */}
          {status === 'pro' ? (
            <button onClick={() => setTab('account')} className="pill text-white font-semibold !px-2.5" style={{ background: 'linear-gradient(135deg,#0a84ff,#30d158)' }} title="Pro 会员">
              <CrownIcon size={13} />Pro
            </button>
          ) : status === 'trial' ? (
            <button onClick={() => setTab('account')} className="pill font-medium bg-[#ff9f0a]/15 text-[#ff9f0a]" title="试用中">
              试用 {daysLeft}天
            </button>
          ) : (
            <button onClick={() => openPaywall()} className="pill font-medium bg-[#0a84ff]/12 text-[#0a84ff]">
              <CrownIcon size={13} />升级
            </button>
          )}
          <button onClick={openNew} className="btn-ghost !p-2 !rounded-full" title="手动记一笔"><PlusIcon size={18} /></button>
          <button onClick={() => setDark((d) => !d)} className="btn-ghost !p-2 !rounded-full" title="切换深浅色">
            {dark ? <SunIcon size={18} /> : <MoonIcon size={18} />}
          </button>
        </div>
      </header>

      {/* 内容 */}
      <main className="flex-1 w-full max-w-2xl mx-auto px-4 py-5 pb-28 sm:pb-10">
        {tab === 'records' && <RecordsView expenses={filteredExpenses} onAdd={addFromText} onEdit={(e) => { setEditing(e); setEditingNew(false) }} onLoadSample={loadSample} sampleMode={sampleMode} onClearAll={clearAllData} />}
        {tab === 'stats' && <Dashboard expenses={filteredExpenses} onGotoHealth={() => setTab('health')} budget={budget} onSettleDebt={(person, amount) => { const type = amount > 0 ? 'income' as const : 'expense' as const; const e: Expense = { id: uid(), type, amount: Math.abs(amount), category: 'social', title: `${person} 清账`, items: [], occurredAt: Date.now(), createdAt: Date.now(), source: 'manual', rawText: `${person}清账${Math.abs(amount)}`, counterparty: person, isDebt: true, ...(activeLedgerId !== 'default' ? { ledgerId: activeLedgerId } : {}) }; update([e, ...expenses]); showToast(`已清账 · ${person}`) }} />}
        {tab === 'health' && <HealthPanel expenses={filteredExpenses} />}
        {tab === 'account' && <AccountView expenses={expenses} onToast={showToast} onClearData={clearAllData} onReload={(records) => { setExpenses(records); persist(records) }} accounts={accounts} onAccountsChange={updateAccounts} />}
      </main>

      {/* 移动端底部导航 */}
      <nav className="sm:hidden fixed bottom-0 inset-x-0 z-30 glass border-t border-[#00000010] dark:border-[#ffffff12] safe-bottom">
        <div className="max-w-2xl mx-auto px-6 h-16 flex items-center justify-around">
          {TABS.map((t) => {
            const active = tab === t.id
            return (
              <button key={t.id} onClick={() => setTab(t.id)} className={`flex flex-col items-center gap-1 transition-colors ${active ? 'text-[#0a84ff]' : 'text-[#86868b]'}`}>
                <t.icon size={22} />
                <span className="text-[11px] font-medium">{t.label}</span>
              </button>
            )
          })}
        </div>
      </nav>

      {/* 编辑/新增 */}
      {editing && (
        <EditSheet
          expense={editing}
          onClose={() => { setEditing(null); setEditingNew(false) }}
          onSave={saveEdit}
          onDelete={editingNew ? undefined : remove}
        />
      )}

      {/* 付费墙 + 登录 */}
      <Paywall onResult={showToast} />
      <LoginSheet />
      <PasswordResetSheet />

      {/* Toast */}
      {toast && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-24 sm:bottom-10 z-50 animate-pop">
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-black/85 dark:bg-white/90 text-white dark:text-black text-[14px] font-medium shadow-apple-lg backdrop-blur">
            <CheckIcon size={16} />{toast}
          </div>
        </div>
      )}
    </div>
  )
}
