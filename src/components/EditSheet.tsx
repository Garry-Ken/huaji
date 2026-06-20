import { useState } from 'react'
import type { CategoryId, Expense, TransactionType } from '../types'
import { CATEGORY_LIST } from '../lib/categories'
import { analyzeMeal } from '../lib/health'
import { XIcon, TrashIcon, CheckIcon } from './icons'

function toLocalInput(ts: number): string {
  const d = new Date(ts)
  const local = new Date(ts - d.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}

export function EditSheet({
  expense,
  onClose,
  onSave,
  onDelete,
}: {
  expense: Expense
  onClose: () => void
  onSave: (e: Expense) => void
  onDelete?: (id: string) => void
}) {
  const [txType, setTxType] = useState<TransactionType>(expense.type ?? 'expense')
  const [amount, setAmount] = useState(String(expense.amount ?? ''))
  const [title, setTitle] = useState(expense.title)
  const [category, setCategory] = useState<CategoryId>(expense.category)
  const [when, setWhen] = useState(toLocalInput(expense.occurredAt))
  const [location, setLocation] = useState(expense.location ?? '')
  const [note, setNote] = useState(expense.note ?? '')
  const [isDebt, setIsDebt] = useState(expense.isDebt ?? false)
  const [counterparty, setCounterparty] = useState(expense.counterparty ?? '')

  const save = () => {
    const amt = parseFloat(amount) || 0
    const occurredAt = when ? new Date(when).getTime() : expense.occurredAt
    const isFood = txType !== 'income' && category === 'food'
    const health = isFood
      ? analyzeMeal([title, note, expense.items.join(' '), expense.rawText].join(' '))
      : undefined
    onSave({
      ...expense,
      type: txType,
      amount: amt,
      title: title.trim() || expense.rawText.slice(0, 12),
      category: txType === 'income' ? 'income' : isDebt ? 'social' : category,
      occurredAt,
      location: location.trim() || undefined,
      note: note.trim() || undefined,
      health,
      meal: isFood ? expense.meal : undefined,
      isDebt: isDebt || undefined,
      counterparty: isDebt && counterparty.trim() ? counterparty.trim() : undefined,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md card !rounded-t-3xl sm:!rounded-3xl rounded-b-none sm:rounded-b-3xl p-5 animate-pop safe-bottom max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[17px] font-semibold">{onDelete ? '编辑记录' : '新增记录'}</h3>
          <button onClick={onClose} className="btn-ghost !p-2 !rounded-full"><XIcon size={18} /></button>
        </div>

        {/* 收/支/借贷 */}
        <div className="seg w-full mb-3">
          <button onClick={() => { setTxType('expense'); setIsDebt(false); if (category === 'income') setCategory('other') }} className={`seg-item flex-1 ${txType === 'expense' && !isDebt ? 'seg-item-active' : ''}`}>支出</button>
          <button onClick={() => { setTxType('income'); setIsDebt(false); setCategory('income') }} className={`seg-item flex-1 ${txType === 'income' && !isDebt ? 'seg-item-active' : ''}`}>收入</button>
          <button onClick={() => { setIsDebt(true); setCategory('social') }} className={`seg-item flex-1 ${isDebt ? 'seg-item-active' : ''}`}>借贷</button>
        </div>

        {isDebt && (
          <div className="mb-4 space-y-2">
            <div className="seg w-full">
              <button onClick={() => setTxType('expense')} className={`seg-item flex-1 ${txType === 'expense' ? 'seg-item-active' : ''}`}>借出</button>
              <button onClick={() => setTxType('income')} className={`seg-item flex-1 ${txType === 'income' ? 'seg-item-active' : ''}`}>借入 / 还款</button>
            </div>
            <input value={counterparty} onChange={e => setCounterparty(e.target.value)} placeholder="交易对方（如 小王）"
              className="w-full rounded-xl bg-[#f5f5f7] dark:bg-[#2c2c2e] px-3 py-2.5 text-[14px] outline-none" maxLength={10} />
          </div>
        )}

        {/* 金额 */}
        <label className="block text-[12px] text-[#86868b] mb-1">金额</label>
        <div className="flex items-center gap-2 mb-4">
          <span className="text-[22px] text-[#86868b]">¥</span>
          <input
            type="number" inputMode="decimal" step="0.01" value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="input-bare text-[28px] font-semibold" placeholder="0" autoFocus
          />
        </div>

        {/* 标题 */}
        <label className="block text-[12px] text-[#86868b] mb-1">{category === 'food' ? '今日美食' : '名称'}</label>
        <input
          value={title} onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-xl bg-[#f5f5f7] dark:bg-[#2c2c2e] px-3 py-2.5 text-[15px] outline-none mb-4"
          placeholder={category === 'food' ? '如 红烧肉、青菜' : '如 打车、淘宝购物'}
        />

        {/* 分类（收入时隐藏，固定 income） */}
        {txType !== 'income' && (
          <>
            <label className="block text-[12px] text-[#86868b] mb-1.5">分类</label>
            <div className="grid grid-cols-5 gap-2 mb-4">
              {CATEGORY_LIST.filter(c => c.id !== 'income').map((c) => {
                const active = c.id === category
                return (
                  <button
                    key={c.id} onClick={() => setCategory(c.id)}
                    className="flex flex-col items-center gap-1 py-2 rounded-xl text-[11px] transition-all"
                    style={active ? { background: c.color + '22', color: c.color, fontWeight: 600 } : undefined}
                  >
                    <span className="text-[18px]">{c.emoji}</span>
                    {c.label}
                  </button>
                )
              })}
            </div>
          </>
        )}

        {/* 时间 + 地点 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-[12px] text-[#86868b] mb-1">时间</label>
            <input
              type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)}
              className="w-full rounded-xl bg-[#f5f5f7] dark:bg-[#2c2c2e] px-3 py-2.5 text-[14px] outline-none"
            />
          </div>
          <div>
            <label className="block text-[12px] text-[#86868b] mb-1">地点</label>
            <input
              value={location} onChange={(e) => setLocation(e.target.value)}
              className="w-full rounded-xl bg-[#f5f5f7] dark:bg-[#2c2c2e] px-3 py-2.5 text-[14px] outline-none"
              placeholder="如 公司楼下"
            />
          </div>
        </div>

        {/* 原始记录 + 补充说明 */}
        <label className="block text-[12px] text-[#86868b] mb-1">原始记录 / 补充说明</label>
        <textarea
          value={note} onChange={(e) => setNote(e.target.value)} rows={2}
          className="w-full rounded-xl bg-[#f5f5f7] dark:bg-[#2c2c2e] px-3 py-2.5 text-[14px] outline-none resize-none mb-5"
          placeholder="自动保存原话，也可补充饮食细节"
        />

        <div className="flex items-center gap-3">
          {onDelete && (
            <button onClick={() => onDelete(expense.id)} className="btn-ghost !text-[#ff3b30]"><TrashIcon size={18} />删除</button>
          )}
          <div className="flex-1" />
          <button onClick={onClose} className="btn-ghost">取消</button>
          <button onClick={save} className="btn-primary"><CheckIcon size={18} />保存</button>
        </div>
      </div>
    </div>
  )
}
