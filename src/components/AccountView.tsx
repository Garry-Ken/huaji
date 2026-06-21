import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { AssetAccount, Expense } from '../types'
import { useEntitlement, TIER_INFO, type Plan, type Tier } from '../lib/entitlement'
import { categoryMeta } from '../lib/categories'
import { exportToJSON, importFromJSON, loadBudget, saveBudget, persist, sortByTime } from '../lib/storage'
import { pushToCloud, pullFromCloud, mergeRecords, getLastSyncDisplay } from '../lib/sync'
import { loadAiConfig, saveAiConfig, AI_DEFAULTS } from '../lib/aiConfig'
import { AI_PROVIDERS, matchProvider } from '../lib/aiProviders'
import { checkUpdate } from '../lib/appUpdate'
import { CrownIcon, LockIcon, CheckIcon, DownloadIcon, CloudIcon, SparkIcon, ChevronRight, UserIcon, UploadIcon, ShieldIcon, TargetIcon, RefreshIcon, InfoIcon, TrashIcon } from './icons'
import { AssetsCard } from './AssetsCard'
import { RecoverSheet } from './RecoverSheet'

const TIER_GRADIENTS: Record<string, string> = {
  plus: 'linear-gradient(135deg,#0a84ff,#5ac8fa)',
  pro: 'linear-gradient(135deg,#0a84ff,#30d158)',
  ultra: 'linear-gradient(135deg,#af52de,#ff375f)',
}

const APP_VERSION = '0.4.17'

function downloadCSV(expenses: Expense[]) {
  const head = ['类型', '消费时间', '录入时间', '分类', '名称', '金额', '地点', '商家', '餐次', '健康分', '原始输入']
  const esc = (v: unknown) => {
    const s = String(v ?? '')
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const fmt = (ts: number) => new Date(ts).toLocaleString('zh-CN', { hour12: false })
  const rows = expenses.map((e) =>
    [e.type === 'income' ? '收入' : '支出', fmt(e.occurredAt), fmt(e.createdAt), categoryMeta(e.category).label, e.title, e.amount, e.location ?? '', e.merchant ?? '', e.meal ?? '', e.health?.score ?? '', e.rawText].map(esc).join(','),
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

export function AccountView({ expenses, onToast, onClearData, onReload, accounts, onAccountsChange }: { expenses: Expense[]; onToast: (m: string) => void; onClearData: () => void; onReload: (records: Expense[]) => void; accounts?: AssetAccount[]; onAccountsChange?: (a: AssetAccount[]) => void }) {
  const ent = useEntitlement()
  const { status, tier, isPlus, isPro, isUltra, daysLeft, aiEnhance, setAiEnhance, openPaywall, user, isAdmin, signOut, openLogin, proPlan, proExpiresAt } = ent
  const fileRef = useRef<HTMLInputElement>(null)
  const [syncing, setSyncing] = useState(false)
  const [budgetOpen, setBudgetOpen] = useState(false)
  const [pwOpen, setPwOpen] = useState(false)
  const [recoverOpen, setRecoverOpen] = useState(false)

  const tierName = tier === 'ultra' ? 'Ultra' : tier === 'pro' ? 'Pro' : tier === 'plus' ? 'Plus' : null
  const statusMeta =
    isAdmin
      ? { title: '店主 · Ultra', sub: '最高权限 · 无限使用', grad: TIER_GRADIENTS.ultra }
    : tier
      ? { title: `${tierName} 会员`, sub: proExpiresAt ? `${planLabel(proPlan)} · 有效期至 ${new Date(proExpiresAt).toLocaleDateString('zh-CN')}` : tierName!, grad: TIER_GRADIENTS[tier] ?? TIER_GRADIENTS.pro }
      : status === 'trial'
        ? { title: '试用中', sub: `Pro 功能免费体验 · 剩 ${daysLeft} 天`, grad: 'linear-gradient(135deg,#ff9f0a,#ff375f)' }
        : status === 'expired'
          ? { title: '免费版', sub: '试用已结束 · 升级解锁全部功能', grad: 'linear-gradient(135deg,#8e8e93,#636366)' }
          : { title: '免费版', sub: '可免费试用 Pro 7 天', grad: 'linear-gradient(135deg,#8e8e93,#636366)' }

  const gated = (reason: string, minTier: 'plus' | 'pro' | 'ultra', action: () => void) => () => {
    const rank = isUltra ? 3 : isPro ? 2 : isPlus ? 1 : 0
    const need = minTier === 'ultra' ? 3 : minTier === 'pro' ? 2 : 1
    rank >= need ? action() : openPaywall(reason)
  }

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
        {!tier && (
          <button onClick={() => openPaywall()} className="btn-primary w-full mt-4">
            <CrownIcon size={18} />
            {status === 'free' ? '开始 7 天免费试用' : '升级会员'}
          </button>
        )}
        {tier && tier !== 'ultra' && (
          <button onClick={() => openPaywall()} className="btn-ghost w-full mt-3 justify-center text-[13px]">
            升级到 {tier === 'plus' ? 'Pro' : 'Ultra'} →
          </button>
        )}
      </div>

      {/* 账号 */}
      <div className="card overflow-hidden divide-y divide-[#00000008] dark:divide-[#ffffff0d]">
        {user ? (
          <>
            <div className="flex items-center gap-3 px-4 py-3.5">
              <span className="text-[#0a84ff]"><UserIcon size={20} /></span>
              <div className="flex-1 min-w-0">
                <div className="text-[15px] font-medium truncate">{user.email}</div>
                <div className="text-[12px] text-[#86868b]">已登录{tierName ? ` · ${tierName} 会员` : ''}</div>
              </div>
              <button onClick={() => { signOut(); onToast('已退出登录') }} className="text-[13px] text-[#ff3b30] font-medium shrink-0">退出</button>
            </div>
            <Row icon={<ShieldIcon size={20} />} title="修改密码" sub="设置或更改登录密码" locked={false} onClick={() => setPwOpen(true)} />
          </>
        ) : (
          <button onClick={openLogin} className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-[#f5f5f7] dark:hover:bg-[#2c2c2e]/40">
            <span className="text-[#0a84ff]"><UserIcon size={20} /></span>
            <div className="flex-1 min-w-0">
              <div className="text-[15px] font-medium">登录 / 恢复购买</div>
              <div className="text-[12px] text-[#86868b]">用邮箱登录，换设备也能恢复会员</div>
            </div>
            <ChevronRight size={18} className="text-[#c7c7cc] shrink-0" />
          </button>
        )}
      </div>

      {/* 权益清单 */}
      <div className="card p-5">
        <h3 className="text-[15px] font-semibold mb-3 flex items-center gap-1.5"><CrownIcon size={16} className="text-[#ff9f0a]" />会员权益</h3>
        <div className="space-y-4">
          {TIER_INFO.map((info) => {
            const rank = isUltra ? 3 : isPro ? 2 : isPlus ? 1 : 0
            const tierRank = info.tier === 'ultra' ? 3 : info.tier === 'pro' ? 2 : 1
            const unlocked = rank >= tierRank
            return (
              <div key={info.tier}>
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-5 h-5 rounded-md flex items-center justify-center text-white" style={{ background: info.gradient }}>
                    <CrownIcon size={10} />
                  </div>
                  <span className="text-[13px] font-semibold">{info.name}</span>
                  <span className="text-[11px] text-[#86868b]">{info.tagline}</span>
                </div>
                <div className="space-y-1.5 pl-7">
                  {info.features.filter(f => !f.startsWith('包含')).map((f) => (
                    <div key={f} className="flex items-center gap-2 text-[13px]">
                      {unlocked ? <CheckIcon size={15} className="text-[#30d158] shrink-0" /> : <LockIcon size={14} className="text-[#c7c7cc] shrink-0" />}
                      <span className={unlocked ? '' : 'text-[#86868b]'}>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 资产账户 */}
      {accounts && onAccountsChange && <AssetsCard accounts={accounts} onChange={onAccountsChange} />}

      {/* 月度预算 */}
      <div className="card overflow-hidden divide-y divide-[#00000008] dark:divide-[#ffffff0d]">
        <button onClick={() => setBudgetOpen(true)} className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-[#f5f5f7] dark:hover:bg-[#2c2c2e]/40 transition-colors">
          <span className="text-[#ff9f0a]"><TargetIcon size={20} /></span>
          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-medium">月度预算</div>
            <div className="text-[12px] text-[#86868b]">{loadBudget() ? `¥${loadBudget()!.toLocaleString('zh-CN')}/月` : '设置每月预算，超支提醒'}</div>
          </div>
          <ChevronRight size={18} className="text-[#c7c7cc] shrink-0" />
        </button>
      </div>

      {/* 偏好与操作 */}
      <div className="card overflow-hidden divide-y divide-[#00000008] dark:divide-[#ffffff0d]">
        <div className="flex items-center gap-3 px-4 py-3.5">
          <span className="text-[#0a84ff]"><SparkIcon size={20} /></span>
          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-medium flex items-center gap-1.5">AI 智能增强 {!isPro && <LockIcon size={13} className="text-[#c7c7cc]" />}</div>
            <div className="text-[12px] text-[#86868b]">用 AI 复核解析与健康建议</div>
          </div>
          <Toggle on={isPro && aiEnhance} disabled={!isPro} onClick={() => (isPro ? setAiEnhance(!aiEnhance) : openPaywall('AI 智能增强是 Pro 功能'))} />
        </div>
      </div>

      {/* 数据管理 */}
      <div className="card overflow-hidden divide-y divide-[#00000008] dark:divide-[#ffffff0d]">
        <Row icon={<CloudIcon size={20} />} title="云端同步" sub={syncing ? '同步中…' : (getLastSyncDisplay() ? `上次同步 ${getLastSyncDisplay()}` : '登录后可同步到云端')} locked={!isPlus} onClick={gated('云同步是 Plus 会员功能', 'plus', async () => {
          if (!user) { onToast('请先登录'); return }
          setSyncing(true)
          const pushRes = await pushToCloud(expenses)
          setSyncing(false)
          onToast(pushRes.ok ? pushRes.msg : pushRes.msg)
        })} />
        <Row icon={<RefreshIcon size={20} />} title="从云端恢复" sub="拉取云端数据合并到本地" locked={!isPlus} onClick={gated('云端恢复是 Plus 会员功能', 'plus', async () => {
          if (!user) { onToast('请先登录'); return }
          setSyncing(true)
          const pullRes = await pullFromCloud()
          setSyncing(false)
          if (!pullRes.ok) { onToast(pullRes.msg); return }
          const merged = sortByTime(mergeRecords(expenses, pullRes.records))
          onReload(merged)
          persist(merged)
          onToast(`已合并，共 ${merged.length} 条记录`)
        })} />
        <Row icon={<TrashIcon size={20} />} title="恢复已删除记录" sub="从云端找回误删的记录" locked={!isPlus} onClick={gated('恢复已删除记录是 Plus 会员功能', 'plus', () => {
          if (!user) { onToast('请先登录'); return }
          setRecoverOpen(true)
        })} />
        <Row icon={<DownloadIcon size={20} />} title="导出 CSV" sub={`当前 ${expenses.length} 条记录`} locked={!isPro} onClick={gated('CSV 导出是 Pro 会员功能', 'pro', () => { downloadCSV(expenses); onToast('已导出 CSV') })} />
      </div>

      {/* 备份（免费功能） */}
      <div className="card overflow-hidden divide-y divide-[#00000008] dark:divide-[#ffffff0d]">
        <Row icon={<DownloadIcon size={20} />} title="备份数据" sub={`导出 JSON 到本地（${expenses.length} 条）`} locked={false} onClick={() => { exportToJSON(expenses); onToast('已导出备份文件') }} />
        <Row icon={<UploadIcon size={20} />} title="恢复数据" sub="从 JSON 备份文件恢复" locked={false} onClick={() => fileRef.current?.click()} />
        <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={async (e) => {
          const file = e.target.files?.[0]
          if (!file) return
          try {
            const records = await importFromJSON(file)
            const merged = sortByTime(mergeRecords(expenses, records))
            onReload(merged)
            persist(merged)
            onToast(`已恢复 ${records.length} 条，合并后共 ${merged.length} 条`)
          } catch (err) {
            onToast(err instanceof Error ? err.message : '恢复失败')
          }
          e.target.value = ''
        }} />
      </div>

      {/* 店主面板：仅店主账号(服务端校验)可见 */}
      {isAdmin && <AdminPanel onToast={onToast} onClearData={onClearData} />}

      {/* 关于 */}
      <div className="card overflow-hidden divide-y divide-[#00000008] dark:divide-[#ffffff0d]">
        <div className="flex items-center gap-3 px-4 py-3.5">
          <span className="text-[#636366] dark:text-[#aeaeb2]"><InfoIcon size={20} /></span>
          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-medium">关于花迹</div>
            <div className="text-[12px] text-[#86868b]">v{APP_VERSION} · 本地优先 · 隐私安全</div>
          </div>
        </div>
        <UpdateRow onToast={onToast} />
        <div className="flex items-center gap-3 px-4 py-3.5">
          <span className="text-[#636366] dark:text-[#aeaeb2]"><ShieldIcon size={20} /></span>
          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-medium">隐私保护</div>
            <div className="text-[12px] text-[#86868b] leading-relaxed">数据默认存储在您的设备本地，不会上传到任何服务器。开启云同步后，数据加密传输至您的专属账户，仅您本人可访问。</div>
          </div>
        </div>
      </div>

      {budgetOpen && <BudgetSheet onClose={() => setBudgetOpen(false)} onToast={onToast} />}
      {pwOpen && <PasswordChangeSheet onClose={() => setPwOpen(false)} onToast={onToast} />}
      {recoverOpen && <RecoverSheet onClose={() => setRecoverOpen(false)} onRecover={(restored) => {
        const merged = sortByTime(mergeRecords(expenses, restored))
        onReload(merged)
        persist(merged)
      }} onToast={onToast} />}
    </div>
  )
}

function AdminPanel({ onToast, onClearData }: { onToast: (m: string) => void; onClearData: () => void }) {
  const { mintCodes, adminGrant } = useEntitlement()
  const [codes, setCodes] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [email, setEmail] = useState('')
  const [grantMsg, setGrantMsg] = useState<string | null>(null)
  const [tier, setTier] = useState<Tier>('pro')

  const tierName = TIER_INFO.find(t => t.tier === tier)?.name ?? 'Pro'

  const mint = async (plan: Plan) => {
    setBusy(true)
    try {
      setCodes(await mintCodes(plan, 5, tier))
      onToast(`已生成 5 个 ${tierName} 兑换码`)
    } catch (e) {
      onToast(e instanceof Error ? e.message : '发码失败')
    }
    setBusy(false)
  }
  const copyOne = (c: string) => {
    navigator.clipboard?.writeText(c).then(() => onToast('已复制')).catch(() => {})
  }
  const copyAll = () => {
    if (codes.length) navigator.clipboard?.writeText(codes.join('\n')).then(() => onToast('已复制全部兑换码')).catch(() => {})
  }
  const grant = async (plan: Plan) => {
    if (!email.trim() || busy) return
    setBusy(true); setGrantMsg(null)
    const r = await adminGrant(email, plan, tier)
    setBusy(false)
    setGrantMsg(r.msg)
    if (r.ok) onToast(r.msg)
  }

  return (
    <div className="card p-4 border border-[#ff9f0a]/30">
      <div className="text-[12px] text-[#ff9f0a] font-semibold mb-3">🛠️ 店主面板（仅你可见）</div>

      {/* 档位选择 */}
      <div className="text-[12px] text-[#86868b] mb-2">① 选择会员档位</div>
      <div className="grid grid-cols-3 gap-2 mb-4">
        {TIER_INFO.map((t) => {
          const active = t.tier === tier
          return (
            <button
              key={t.tier}
              onClick={() => { setTier(t.tier); setCodes([]); setGrantMsg(null) }}
              className="rounded-xl py-2 text-[13px] font-semibold transition-all"
              style={active
                ? { background: t.gradient, color: '#fff' }
                : { background: 'var(--soft,#f5f5f7)', color: '#86868b' }}
            >
              {t.name}
            </button>
          )
        })}
      </div>
      <div className="text-[11px] text-[#86868b] mb-3 -mt-2">{TIER_INFO.find(t => t.tier === tier)?.tagline} · {TIER_INFO.find(t => t.tier === tier)?.features[0]}</div>

      {/* 发码 */}
      <div className="text-[12px] text-[#86868b] mb-2">② 批量生成 5 个 <b className="text-[#1d1d1f] dark:text-[#f5f5f7]">{tierName}</b> 兑换码（每个仅可用一次）</div>
      <div className="grid grid-cols-3 gap-2">
        {(['monthly', 'quarterly', 'annual'] as Plan[]).map((p) => (
          <button key={p} disabled={busy} onClick={() => mint(p)} className="btn-ghost justify-center text-[13px]">{planLabel(p)}×5</button>
        ))}
      </div>
      {codes.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {codes.map((c) => (
            <button key={c} onClick={() => copyOne(c)} className="w-full flex items-center justify-between gap-2 rounded-xl bg-[#0a84ff]/10 px-3 py-2 text-[#0a84ff]">
              <span className="font-mono text-[13px] tracking-wide truncate">{c}</span>
              <span className="text-[11px] shrink-0">复制</span>
            </button>
          ))}
          <button onClick={copyAll} className="w-full text-center text-[12px] text-[#0a84ff] font-medium mt-1">一键复制全部</button>
        </div>
      )}

      {/* 按邮箱直接开通 */}
      <div className="text-[12px] text-[#86868b] mt-4 mb-2">或：按买家邮箱直接开通 <b className="text-[#1d1d1f] dark:text-[#f5f5f7]">{tierName}</b>（对方需先登录过一次）</div>
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

      {/* AI 接入配置 */}
      <AiConfigPanel onToast={onToast} />

      {/* 清理数据 */}
      <button onClick={onClearData} className="btn-ghost w-full justify-center text-[13px] mt-4 !text-[#ff375f]">清空全部记录（本机）</button>
    </div>
  )
}

function AiConfigPanel({ onToast }: { onToast: (m: string) => void }) {
  const [apiKey, setApiKey] = useState('')
  const [baseURL, setBaseURL] = useState('')
  const [model, setModel] = useState('')
  const [provider, setProvider] = useState('custom')
  const [loaded, setLoaded] = useState(false)
  const [show, setShow] = useState(false)
  const [advanced, setAdvanced] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    loadAiConfig(true).then((c) => {
      setApiKey(c.apiKey)
      setBaseURL(c.baseURL)
      setModel(c.model)
      setProvider(matchProvider(c.baseURL))
      setLoaded(true)
    })
  }, [])

  const curProvider = AI_PROVIDERS.find((p) => p.id === provider)

  const pickProvider = (p: typeof AI_PROVIDERS[number]) => {
    setProvider(p.id)
    if (p.id !== 'custom') {
      setBaseURL(p.baseURL)
      if (p.models.length && !p.models.includes(model)) setModel(p.models[0])
    }
  }

  const save = async () => {
    if (busy) return
    setBusy(true)
    const r = await saveAiConfig({ apiKey: apiKey.trim(), baseURL: baseURL.trim() || AI_DEFAULTS.baseURL, model: model.trim() || AI_DEFAULTS.model })
    setBusy(false)
    onToast(r.msg)
  }

  const masked = apiKey && !show ? apiKey.slice(0, 6) + '••••••' + apiKey.slice(-4) : apiKey
  const inputCls = 'w-full rounded-xl bg-[#f5f5f7] dark:bg-[#2c2c2e] px-3 py-2.5 text-[13px] outline-none mb-2 font-mono'

  return (
    <div className="mt-5 pt-4 border-t border-[#00000010] dark:border-[#ffffff14]">
      <div className="text-[12px] text-[#86868b] mb-2">🤖 AI 接入配置（选服务商→填 Key→选模型，改完即时生效）</div>

      {/* 服务商预设 */}
      <label className="block text-[11px] text-[#86868b] mb-1.5">服务商</label>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {AI_PROVIDERS.map((p) => {
          const active = p.id === provider
          return (
            <button
              key={p.id}
              onClick={() => pickProvider(p)}
              className={`text-[12px] px-2.5 py-1 rounded-full border transition-colors ${active ? 'bg-[#0a84ff] text-white border-[#0a84ff]' : 'bg-transparent text-[#636366] dark:text-[#aeaeb2] border-[#d2d2d7] dark:border-[#48484a]'}`}
            >
              {p.name}
            </button>
          )
        })}
      </div>

      {/* API Key */}
      <div className="flex items-center justify-between mb-1">
        <label className="text-[11px] text-[#86868b]">API Key{curProvider?.keyHint ? ` · 格式 ${curProvider.keyHint}` : ''}</label>
        {curProvider?.site && <a href={curProvider.site} target="_blank" rel="noreferrer" className="text-[11px] text-[#0a84ff]">获取 Key ↗</a>}
      </div>
      <div className="relative">
        <input
          value={show ? apiKey : masked}
          onChange={(e) => { setApiKey(e.target.value); setShow(true) }}
          onFocus={() => setShow(true)}
          placeholder={loaded ? (curProvider?.keyHint ?? 'sk-...') : '加载中…'}
          className={inputCls + ' pr-14'}
          spellCheck={false}
        />
        <button onClick={() => setShow((s) => !s)} className="absolute right-3 top-2.5 text-[12px] text-[#0a84ff]">{show ? '隐藏' : '显示'}</button>
      </div>

      {/* 模型 */}
      <label className="block text-[11px] text-[#86868b] mb-1">模型 Model</label>
      {curProvider && curProvider.models.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {curProvider.models.map((mm) => (
            <button
              key={mm}
              onClick={() => setModel(mm)}
              className={`text-[12px] px-2.5 py-1 rounded-full border transition-colors font-mono ${model === mm ? 'bg-[#30d158]/15 text-[#30d158] border-[#30d158]/40' : 'bg-transparent text-[#636366] dark:text-[#aeaeb2] border-[#d2d2d7] dark:border-[#48484a]'}`}
            >
              {mm}
            </button>
          ))}
        </div>
      )}
      <input value={model} onChange={(e) => setModel(e.target.value)} placeholder={AI_DEFAULTS.model} className={inputCls} spellCheck={false} />

      {/* 高级：接口地址 */}
      <button onClick={() => setAdvanced((a) => !a)} className="text-[11px] text-[#0a84ff] mb-1">{advanced ? '收起' : '高级'} · 接口地址</button>
      {advanced && (
        <input value={baseURL} onChange={(e) => { setBaseURL(e.target.value); setProvider(matchProvider(e.target.value)) }} placeholder={AI_DEFAULTS.baseURL} className={inputCls} spellCheck={false} />
      )}

      <button onClick={save} disabled={busy || !loaded} className="btn-primary w-full justify-center text-[13px] mt-2 disabled:opacity-50">{busy ? '保存中…' : '保存 AI 配置'}</button>
      <p className="text-[11px] text-[#86868b] mt-2 leading-relaxed">密钥存于 Supabase，仅店主可写，不进代码或前端打包。内置 {AI_PROVIDERS.length - 1} 家兼容 OpenAI 格式的服务商，换厂商点一下即可；模型可在预设里选或自己填。</p>
    </div>
  )
}

function UpdateRow({ onToast }: { onToast: (m: string) => void }) {
  const [busy, setBusy] = useState(false)
  const [info, setInfo] = useState<{ latest: string; hasUpdate: boolean; url: string } | null>(null)

  const check = async () => {
    if (busy) return
    setBusy(true)
    const r = await checkUpdate(APP_VERSION)
    setBusy(false)
    if ('error' in r) { onToast(r.error); return }
    setInfo(r)
    if (!r.hasUpdate) onToast('已是最新版 ✓')
  }

  return (
    <button onClick={info?.hasUpdate ? () => window.open(info.url, '_blank') : check} className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-[#f5f5f7] dark:hover:bg-[#2c2c2e]/40 transition-colors">
      <span className="text-[#636366] dark:text-[#aeaeb2]"><RefreshIcon size={20} /></span>
      <div className="flex-1 min-w-0">
        <div className="text-[15px] font-medium flex items-center gap-1.5">
          {info?.hasUpdate ? '发现新版本' : '检查更新'}
          {info?.hasUpdate && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#ff3b30] text-white font-semibold">v{info.latest}</span>}
        </div>
        <div className="text-[12px] text-[#86868b] truncate">
          {busy ? '检查中…' : info?.hasUpdate ? '点击前往下载（覆盖安装，无需卸载）' : `当前 v${APP_VERSION}`}
        </div>
      </div>
      <ChevronRight size={18} className="text-[#c7c7cc] shrink-0" />
    </button>
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

function BudgetSheet({ onClose, onToast }: { onClose: () => void; onToast: (m: string) => void }) {
  const current = loadBudget()
  const [value, setValue] = useState(current ? String(current) : '')

  const save = () => {
    const n = parseFloat(value)
    if (value.trim() && (isNaN(n) || n <= 0)) { onToast('请输入有效金额'); return }
    saveBudget(value.trim() ? n : null)
    onToast(value.trim() ? `已设置月度预算 ¥${n.toLocaleString('zh-CN')}` : '已取消月度预算')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-sm card !rounded-t-3xl sm:!rounded-3xl rounded-b-none p-6 animate-pop safe-bottom">
        <h3 className="text-[17px] font-semibold mb-1">月度预算</h3>
        <p className="text-[13px] text-[#86868b] mb-4">设置后在首页和统计页显示预算进度</p>
        <div className="flex items-center gap-2 mb-4">
          <span className="text-[22px] text-[#86868b]">¥</span>
          <input
            type="number" inputMode="decimal" autoFocus
            value={value} onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') save() }}
            placeholder="如 3000"
            className="input-bare text-[28px] font-semibold"
          />
          <span className="text-[14px] text-[#86868b]">/月</span>
        </div>
        <div className="flex gap-2 flex-wrap mb-4">
          {[1000, 2000, 3000, 5000, 8000].map(n => (
            <button key={n} onClick={() => setValue(String(n))} className={`btn-ghost text-[13px] ${value === String(n) ? '!bg-[#0a84ff]/10 !text-[#0a84ff]' : ''}`}>
              ¥{n.toLocaleString('zh-CN')}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          {current && <button onClick={() => { saveBudget(null); onToast('已取消月度预算'); onClose() }} className="btn-ghost !text-[#ff3b30]">取消预算</button>}
          <div className="flex-1" />
          <button onClick={onClose} className="btn-ghost">取消</button>
          <button onClick={save} className="btn-primary"><CheckIcon size={18} />保存</button>
        </div>
      </div>
    </div>
  )
}

function PasswordChangeSheet({ onClose, onToast }: { onClose: () => void; onToast: (m: string) => void }) {
  const { updatePassword } = useEntitlement()
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const mismatch = pw2.length > 0 && pw !== pw2
  const valid = pw.length >= 6 && pw === pw2

  const save = async () => {
    if (!valid || busy) return
    setBusy(true); setMsg(null)
    const r = await updatePassword(pw)
    setBusy(false)
    if (r.ok) { onToast('密码已更新 ✓'); onClose() }
    else setMsg(r.msg)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-sm card !rounded-t-3xl sm:!rounded-3xl rounded-b-none p-6 animate-pop safe-bottom">
        <h3 className="text-[17px] font-semibold mb-1">设置密码</h3>
        <p className="text-[13px] text-[#86868b] mb-4">设置后可使用密码登录（至少 6 位）</p>
        <input type="password" autoFocus value={pw} onChange={(e) => { setPw(e.target.value); setMsg(null) }} placeholder="新密码"
          className="w-full rounded-xl bg-[#f5f5f7] dark:bg-[#2c2c2e] px-3.5 py-3 text-[15px] outline-none mb-3" />
        <input type="password" value={pw2} onChange={(e) => { setPw2(e.target.value); setMsg(null) }} onKeyDown={(e) => { if (e.key === 'Enter') save() }} placeholder="确认密码"
          className="w-full rounded-xl bg-[#f5f5f7] dark:bg-[#2c2c2e] px-3.5 py-3 text-[15px] outline-none mb-3" />
        {mismatch && <p className="text-[12px] text-[#ff3b30] mb-2">两次密码不一致</p>}
        {msg && <p className="text-[12px] text-[#ff3b30] mb-2">{msg}</p>}
        <div className="flex items-center gap-3">
          <div className="flex-1" />
          <button onClick={onClose} className="btn-ghost">取消</button>
          <button onClick={save} disabled={!valid || busy} className="btn-primary">{busy ? '设置中…' : '确认'}</button>
        </div>
      </div>
    </div>
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
