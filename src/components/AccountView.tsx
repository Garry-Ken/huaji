import { useState } from 'react'
import type { ReactNode } from 'react'
import type { Expense } from '../types'
import { useEntitlement, type Plan } from '../lib/entitlement'
import { categoryMeta } from '../lib/categories'
import { CrownIcon, LockIcon, CheckIcon, DownloadIcon, CloudIcon, SparkIcon, ChevronRight, UserIcon } from './icons'

const PRO_ROWS = [
  { key: 'period', label: '季度 / 半年 / 年度深度分析' },
  { key: 'health', label: '饮食健康长周期趋势' },
  { key: 'ai', label: 'AI 智能增强（Claude）' },
  { key: 'sync', label: '跨设备云同步' },
  { key: 'export', label: '数据导出 CSV' },
  { key: 'history', label: '无限历史记录' },
]

function downloadCSV(expenses: Expense[]) {
  const head = ['消费时间', '录入时间', '分类', '名称', '金额', '地点', '商家', '餐次', '健康分', '原始输入']
  const esc = (v: unknown) => {
    const s = String(v ?? '')
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const fmt = (ts: number) => new Date(ts).toLocaleString('zh-CN', { hour12: false })
  const rows = expenses.map((e) =>
    [fmt(e.occurredAt), fmt(e.createdAt), categoryMeta(e.category).label, e.title, e.amount, e.location ?? '', e.merchant ?? '', e.meal ?? '', e.health?.score ?? '', e.rawText].map(esc).join(','),
  )
  const csv = '﻿' + [head.join(','), ...rows].join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `花迹导出_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function planLabel(p?: string) {
  return p === 'monthly' ? '月度' : p === 'quarterly' ? '季度' : p === 'annual' ? '年度' : 'Pro'
}

export function AccountView({ expenses, onToast, onClearData }: { expenses: Expense[]; onToast: (m: string) => void; onClearData: () => void }) {
  const ent = useEntitlement()
  const { status, isPro, daysLeft, aiEnhance, setAiEnhance, openPaywall, user, isAdmin, signOut, openLogin, proPlan, proExpiresAt } = ent

  const statusMeta =
    status === 'pro'
      ? { title: 'Pro 会员', sub: proExpiresAt ? `${planLabel(proPlan)} · 有效期至 ${new Date(proExpiresAt).toLocaleDateString('zh-CN')}` : 'Pro', grad: 'linear-gradient(135deg,#0a84ff,#30d158)' }
      : status === 'trial'
        ? { title: '试用中', sub: `Pro 功能免费体验 · 剩 ${daysLeft} 天`, grad: 'linear-gradient(135deg,#ff9f0a,#ff375f)' }
        : status === 'expired'
          ? { title: '免费版', sub: '试用已结束 · 升级解锁全部功能', grad: 'linear-gradient(135deg,#8e8e93,#636366)' }
          : { title: '免费版', sub: '可免费试用 Pro 7 天', grad: 'linear-gradient(135deg,#8e8e93,#636366)' }

  const gated = (reason: string, action: () => void) => () => (isPro ? action() : openPaywall(reason))

  return (
    <div className="space-y-4">
      {/* 状态卡 */}
      <div className="card p-5">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shrink-0" style={{ background: statusMeta.grad }}>
            <CrownIcon size={24} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-[17px]">{statusMeta.title}</div>
            <div className="text-[12px] text-[#86868b] mt-0.5">{statusMeta.sub}</div>
          </div>
        </div>
        {status !== 'pro' && (
          <button onClick={() => openPaywall()} className="btn-primary w-full mt-4">
            <CrownIcon size={18} />
            {status === 'free' ? '开始 7 天免费试用' : '升级 Pro'}
          </button>
        )}
      </div>

      {/* 账号 */}
      <div className="card overflow-hidden">
        {user ? (
          <div className="flex items-center gap-3 px-4 py-3.5">
            <span className="text-[#0a84ff]"><UserIcon size={20} /></span>
            <div className="flex-1 min-w-0">
              <div className="text-[15px] font-medium truncate">{user.email}</div>
              <div className="text-[12px] text-[#86868b]">已登录 · Pro 权益跨设备同步</div>
            </div>
            <button onClick={() => { signOut(); onToast('已退出登录') }} className="text-[13px] text-[#ff3b30] font-medium shrink-0">退出</button>
          </div>
        ) : (
          <button onClick={openLogin} className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-[#f5f5f7] dark:hover:bg-[#2c2c2e]/40">
            <span className="text-[#0a84ff]"><UserIcon size={20} /></span>
            <div className="flex-1 min-w-0">
              <div className="text-[15px] font-medium">登录 / 恢复购买</div>
              <div className="text-[12px] text-[#86868b]">用邮箱登录，换设备也能恢复 Pro</div>
            </div>
            <ChevronRight size={18} className="text-[#c7c7cc] shrink-0" />
          </button>
        )}
      </div>

      {/* 权益清单 */}
      <div className="card p-5">
        <h3 className="text-[15px] font-semibold mb-3 flex items-center gap-1.5"><CrownIcon size={16} className="text-[#ff9f0a]" />Pro 权益</h3>
        <div className="space-y-2.5">
          {PRO_ROWS.map((r) => (
            <div key={r.key} className="flex items-center gap-2.5 text-[14px]">
              {isPro ? <CheckIcon size={17} className="text-[#30d158] shrink-0" /> : <LockIcon size={16} className="text-[#c7c7cc] shrink-0" />}
              <span className={isPro ? '' : 'text-[#86868b]'}>{r.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 偏好与操作 */}
      <div className="card overflow-hidden divide-y divide-[#00000008] dark:divide-[#ffffff0d]">
        <div className="flex items-center gap-3 px-4 py-3.5">
          <span className="text-[#0a84ff]"><SparkIcon size={20} /></span>
          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-medium flex items-center gap-1.5">AI 智能增强 {!isPro && <LockIcon size={13} className="text-[#c7c7cc]" />}</div>
            <div className="text-[12px] text-[#86868b]">用 Claude 复核解析与健康建议（Phase 2 接入）</div>
          </div>
          <Toggle on={isPro && aiEnhance} disabled={!isPro} onClick={() => (isPro ? setAiEnhance(!aiEnhance) : openPaywall('AI 智能增强是 Pro 功能'))} />
        </div>
        <Row icon={<CloudIcon size={20} />} title="跨设备云同步" sub={isPro ? '即将接入（Phase 2）' : '升级后可在多设备同步'} locked={!isPro} onClick={gated('云同步是 Pro 功能', () => onToast('云同步即将接入'))} />
        <Row icon={<DownloadIcon size={20} />} title="导出 CSV" sub={`当前 ${expenses.length} 条记录`} locked={!isPro} onClick={gated('数据导出是 Pro 功能', () => { downloadCSV(expenses); onToast('已导出 CSV') })} />
      </div>

      {/* 店主面板：仅店主账号(服务端校验)可见 */}
      {isAdmin && <AdminPanel onToast={onToast} onClearData={onClearData} />}

      <div className="text-center text-[12px] text-[#86868b] py-2">花迹 v0.1.1 · 数据本地优先 · Pro 由账号同步</div>
    </div>
  )
}

function AdminPanel({ onToast, onClearData }: { onToast: (m: string) => void; onClearData: () => void }) {
  const { mintCode, adminGrant } = useEntitlement()
  const [code, setCode] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [email, setEmail] = useState('')
  const [grantMsg, setGrantMsg] = useState<string | null>(null)

  const mint = async (plan: Plan) => {
    setBusy(true)
    try {
      setCode(await mintCode(plan))
      onToast('已生成兑换码')
    } catch (e) {
      onToast(e instanceof Error ? e.message : '发码失败')
    }
    setBusy(false)
  }
  const copy = () => {
    if (code) navigator.clipboard?.writeText(code).then(() => onToast('已复制兑换码')).catch(() => {})
  }
  const grant = async (plan: Plan) => {
    if (!email.trim() || busy) return
    setBusy(true); setGrantMsg(null)
    const r = await adminGrant(email, plan)
    setBusy(false)
    setGrantMsg(r.msg)
    if (r.ok) onToast(r.msg)
  }

  return (
    <div className="card p-4 border border-[#ff9f0a]/30">
      <div className="text-[12px] text-[#ff9f0a] font-semibold mb-3">🛠️ 店主面板（仅你可见）</div>

      {/* 发码 */}
      <div className="text-[12px] text-[#86868b] mb-2">生成兑换码（买家付款后发给他）</div>
      <div className="grid grid-cols-3 gap-2">
        {(['monthly', 'quarterly', 'annual'] as Plan[]).map((p) => (
          <button key={p} disabled={busy} onClick={() => mint(p)} className="btn-ghost justify-center text-[13px]">{planLabel(p)}码</button>
        ))}
      </div>
      {code && (
        <button onClick={copy} className="mt-3 w-full flex items-center justify-between gap-2 rounded-xl bg-[#0a84ff]/10 px-3 py-2.5 text-[#0a84ff]">
          <span className="font-mono text-[14px] tracking-wide truncate">{code}</span>
          <span className="text-[12px] shrink-0">点击复制</span>
        </button>
      )}

      {/* 按邮箱直接开通 */}
      <div className="text-[12px] text-[#86868b] mt-4 mb-2">或：按买家邮箱直接开通（对方需先登录过一次）</div>
      <input
        type="email"
        value={email}
        onChange={(e) => { setEmail(e.target.value); setGrantMsg(null) }}
        placeholder="buyer@example.com"
        className="w-full rounded-xl bg-[#f5f5f7] dark:bg-[#2c2c2e] px-3 py-2.5 text-[14px] outline-none mb-2"
      />
      <div className="grid grid-cols-3 gap-2">
        {(['monthly', 'quarterly', 'annual'] as Plan[]).map((p) => (
          <button key={p} disabled={busy || !email.trim()} onClick={() => grant(p)} className="btn-ghost justify-center text-[13px]">开{planLabel(p)}</button>
        ))}
      </div>
      {grantMsg && <p className="text-[12px] text-[#86868b] mt-2">{grantMsg}</p>}

      {/* 清理数据 */}
      <button onClick={onClearData} className="btn-ghost w-full justify-center text-[13px] mt-4 !text-[#ff375f]">清空全部记录（本机）</button>
    </div>
  )
}

function Row({ icon, title, sub, locked, onClick }: { icon: ReactNode; title: string; sub: string; locked: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-[#f5f5f7] dark:hover:bg-[#2c2c2e]/40 transition-colors">
      <span className="text-[#636366] dark:text-[#aeaeb2]">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-[15px] font-medium flex items-center gap-1.5">{title} {locked && <LockIcon size={13} className="text-[#c7c7cc]" />}</div>
        <div className="text-[12px] text-[#86868b] truncate">{sub}</div>
      </div>
      <ChevronRight size={18} className="text-[#c7c7cc] shrink-0" />
    </button>
  )
}

function Toggle({ on, disabled, onClick }: { on: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`relative w-[51px] h-[31px] rounded-full transition-colors shrink-0 ${on ? 'bg-[#30d158]' : 'bg-[#e9e9ea] dark:bg-[#39393d]'} ${disabled ? 'opacity-60' : ''}`}
      role="switch"
      aria-checked={on}
    >
      <span className={`absolute top-[2px] left-[2px] w-[27px] h-[27px] rounded-full bg-white shadow transition-transform ${on ? 'translate-x-[20px]' : ''}`} />
    </button>
  )
}
