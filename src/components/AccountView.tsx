import { useState } from 'react'
import type { ReactNode } from 'react'
import type { Expense } from '../types'
import { useEntitlement, type Plan } from '../lib/entitlement'
import { categoryMeta } from '../lib/categories'
import { CrownIcon, LockIcon, CheckIcon, DownloadIcon, CloudIcon, SparkIcon, ChevronRight } from './icons'

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
  const csv = '﻿' + [head.join(','), ...rows].join('\n') // BOM for Excel 中文
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `花迹导出_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function AccountView({ expenses, onToast }: { expenses: Expense[]; onToast: (m: string) => void }) {
  const ent = useEntitlement()
  const { status, isPro, daysLeft, aiEnhance, setAiEnhance, openPaywall } = ent

  const statusMeta =
    status === 'pro'
      ? { title: 'Pro 会员', sub: ent.ent.proExpiresAt ? `${planLabel(ent.ent.proPlan)} · 有效期至 ${new Date(ent.ent.proExpiresAt).toLocaleDateString('zh-CN')}` : 'Pro', grad: 'linear-gradient(135deg,#0a84ff,#30d158)' }
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
        {status === 'pro' && (
          <button onClick={() => { ent.cancel(); onToast('已取消订阅（演示）') }} className="btn-ghost w-full mt-4">管理订阅</button>
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
        {/* AI 增强 */}
        <div className="flex items-center gap-3 px-4 py-3.5">
          <span className="text-[#0a84ff]"><SparkIcon size={20} /></span>
          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-medium flex items-center gap-1.5">AI 智能增强 {!isPro && <LockIcon size={13} className="text-[#c7c7cc]" />}</div>
            <div className="text-[12px] text-[#86868b]">用 Claude 复核解析与健康建议（Phase 2 接入）</div>
          </div>
          <Toggle
            on={isPro && aiEnhance}
            disabled={!isPro}
            onClick={() => (isPro ? setAiEnhance(!aiEnhance) : openPaywall('AI 智能增强是 Pro 功能'))}
          />
        </div>
        {/* 云同步 */}
        <Row icon={<CloudIcon size={20} />} title="跨设备云同步" sub={isPro ? '即将接入（Phase 1 后端）' : '升级后可在多设备同步'} locked={!isPro} onClick={gated('云同步是 Pro 功能', () => onToast('云同步即将接入'))} />
        {/* 导出 */}
        <Row icon={<DownloadIcon size={20} />} title="导出 CSV" sub={`当前 ${expenses.length} 条记录`} locked={!isPro} onClick={gated('数据导出是 Pro 功能', () => { downloadCSV(expenses); onToast('已导出 CSV') })} />
      </div>

      {/* 管理员发码：用户付款后用这里生成兑换码发给他 */}
      <MintCodes onToast={onToast} />

      {/* 演示控制 */}
      <div className="card p-4">
        <div className="text-[12px] text-[#86868b] mb-2.5">🧪 演示控制（生产环境会移除）</div>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => { ent.startTrial(); onToast('已开始 7 天试用') }} className="btn-ghost justify-center text-[13px]">开始试用</button>
          <button onClick={() => { ent.expireTrial(); onToast('已模拟试用到期') }} className="btn-ghost justify-center text-[13px]">模拟试用到期</button>
          <button onClick={() => { ent.subscribe('annual'); onToast('已开通 Pro 年度（演示）') }} className="btn-ghost justify-center text-[13px]">模拟订阅</button>
          <button onClick={() => { ent.resetAll(); onToast('已重置为免费') }} className="btn-ghost justify-center text-[13px]">重置为免费</button>
        </div>
      </div>

      <div className="text-center text-[12px] text-[#86868b] py-2">
        花迹 v0.1 · 本地优先，数据存于本机
      </div>
    </div>
  )
}

function planLabel(p?: string) {
  return p === 'monthly' ? '月度' : p === 'quarterly' ? '季度' : p === 'annual' ? '年度' : 'Pro'
}

function MintCodes({ onToast }: { onToast: (m: string) => void }) {
  const { mintCode } = useEntitlement()
  const [code, setCode] = useState<string | null>(null)
  const mint = async (plan: Plan) => {
    setCode(await mintCode(plan))
  }
  const copy = () => {
    if (!code) return
    navigator.clipboard?.writeText(code).then(() => onToast('已复制兑换码')).catch(() => {})
  }
  return (
    <div className="card p-4">
      <div className="text-[12px] text-[#86868b] mb-2.5">🎟️ 管理员发码 · 收到付款后生成兑换码发给买家</div>
      <div className="grid grid-cols-3 gap-2">
        {(['monthly', 'quarterly', 'annual'] as Plan[]).map((p) => (
          <button key={p} onClick={() => mint(p)} className="btn-ghost justify-center text-[13px]">{planLabel(p)}码</button>
        ))}
      </div>
      {code && (
        <button onClick={copy} className="mt-3 w-full flex items-center justify-between gap-2 rounded-xl bg-[#0a84ff]/10 px-3 py-2.5 text-[#0a84ff]">
          <span className="font-mono text-[14px] tracking-wide truncate">{code}</span>
          <span className="text-[12px] shrink-0">点击复制</span>
        </button>
      )}
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
