import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { genCode, verifyCode, isUsed, markUsed, PLAN_MONTHS } from './redeem'

// ============================================================================
// 权益中心 (Entitlement)
//
// 这是订阅商业化的“唯一真相”层：谁在试用、谁是 Pro、到期时间。
// 当前为【纯前端 MVP】——状态存在 localStorage，订阅是模拟的、不会真实扣款。
//
// ⛳️ 后端接入点（分阶段）见文件底部 BACKEND SEAMS：
//   Phase 1: Supabase 账号 + 权益表 + Stripe / 微信支付宝 Webhook
//   Phase 2: RevenueCat 统一 iOS / Android 内购
// 把 loadEntitlement / subscribe / restore 换成真实实现即可，UI 不用动。
// ============================================================================

const DAY = 86400000
const TRIAL_DAYS = 7
const STORE_KEY = 'huaji.entitlement.v1'

export type Plan = 'monthly' | 'quarterly' | 'annual'
export type Region = 'cn' | 'intl'
/** free=从未试用 · trial=试用中 · pro=已订阅 · expired=试用已结束(回到免费) */
export type Status = 'free' | 'trial' | 'pro' | 'expired'

export interface Entitlement {
  region: Region
  trialStartedAt?: number
  proPlan?: Plan
  proStartedAt?: number
  proExpiresAt?: number
  aiEnhance: boolean // 用户偏好；仅在 isPro 时生效
}

// —— 定价（按你的策略：月度基准，季度/年度 8 折）——
export interface PlanInfo {
  id: Plan
  label: string
  total: number // 该周期总价
  months: number
  perMonth: number
  saveLabel?: string
  badge?: string
}

// 定价阶梯：月度基准 · 季度 8 折 · 年度 7 折（让年付明显更划算，提升年订转化）
const RAW = {
  cn: { sym: '¥', monthly: 20, quarterly: 48, annual: 168 },
  intl: { sym: '$', monthly: 19.99, quarterly: 47.98, annual: 167.9 },
} as const

export function pricing(region: Region): { sym: string; plans: PlanInfo[] } {
  const r = RAW[region]
  const round = (n: number) => Math.round(n * 100) / 100
  const monthlyTotalForTerm = (months: number) => r.monthly * months
  const mk = (id: Plan, total: number, months: number, badge?: string): PlanInfo => {
    const save = 1 - total / monthlyTotalForTerm(months)
    return {
      id,
      label: id === 'monthly' ? '月度' : id === 'quarterly' ? '季度' : '年度',
      total: round(total),
      months,
      perMonth: round(total / months),
      saveLabel: save > 0.01 ? `省 ${Math.round(save * 100)}%` : undefined,
      badge,
    }
  }
  return {
    sym: r.sym,
    plans: [
      mk('monthly', r.monthly, 1),
      mk('quarterly', r.quarterly, 3),
      mk('annual', r.annual, 12, '最划算'),
    ],
  }
}

export function formatPrice(region: Region, n: number): string {
  const sym = RAW[region].sym
  const isInt = Math.abs(n - Math.round(n)) < 1e-9
  return sym + (isInt ? String(Math.round(n)) : n.toFixed(2))
}

// ---------- 持久化 ----------
function loadEntitlement(): Entitlement {
  // ⛳️ BACKEND SEAM (Phase 1): 改为 await supabase.from('entitlements')...
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (raw) return { region: 'cn', aiEnhance: false, ...JSON.parse(raw) }
  } catch {
    /* ignore */
  }
  const region: Region = typeof navigator !== 'undefined' && /^zh/i.test(navigator.language) ? 'cn' : 'intl'
  return { region, aiEnhance: false }
}

function persist(e: Entitlement) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(e))
  } catch {
    /* ignore */
  }
}

// ---------- 状态派生 ----------
export function deriveStatus(e: Entitlement, now = Date.now()): Status {
  if (e.proExpiresAt && e.proExpiresAt > now) return 'pro'
  const trialEnds = e.trialStartedAt ? e.trialStartedAt + TRIAL_DAYS * DAY : 0
  if (trialEnds > now) return 'trial'
  if (e.trialStartedAt) return 'expired'
  return 'free'
}

export function trialDaysLeft(e: Entitlement, now = Date.now()): number {
  if (!e.trialStartedAt) return 0
  const left = e.trialStartedAt + TRIAL_DAYS * DAY - now
  return Math.max(0, Math.ceil(left / DAY))
}

// ---------- Context ----------
interface Ctx {
  ent: Entitlement
  status: Status
  isPro: boolean // trial 或 pro 均解锁
  daysLeft: number
  region: Region
  aiEnhance: boolean
  // 操作
  startTrial: () => void
  subscribe: (plan: Plan) => void // 模拟，留缝接 Stripe/RevenueCat
  redeem: (code: string) => Promise<{ ok: boolean; msg: string }> // 兑换码开通（个人收款主路径）
  mintCode: (plan: Plan) => Promise<string> // 管理员发码
  restore: () => void
  cancel: () => void // 演示：回到免费
  expireTrial: () => void // 演示：把试用快进到已结束
  resetAll: () => void // 演示：清空回到“从未试用”
  setRegion: (r: Region) => void
  setAiEnhance: (v: boolean) => void
  // 付费墙
  paywallOpen: boolean
  paywallReason?: string
  openPaywall: (reason?: string) => void
  closePaywall: () => void
}

const EntitlementContext = createContext<Ctx | null>(null)

export function EntitlementProvider({ children }: { children: ReactNode }) {
  const [ent, setEnt] = useState<Entitlement>(() => loadEntitlement())
  const [paywallOpen, setPaywallOpen] = useState(false)
  const [paywallReason, setPaywallReason] = useState<string | undefined>()

  useEffect(() => persist(ent), [ent])

  const update = useCallback((patch: Partial<Entitlement>) => setEnt((p) => ({ ...p, ...patch })), [])

  const startTrial = useCallback(() => {
    setEnt((p) => (p.trialStartedAt ? p : { ...p, trialStartedAt: Date.now() }))
    setPaywallOpen(false)
  }, [])

  const subscribe = useCallback((plan: Plan) => {
    // ⛳️ BACKEND SEAM: 这里应发起 Stripe Checkout / RevenueCat 购买，
    // 成功回调后由后端 Webhook 写入权益。MVP 里直接本地置为 Pro。
    const months = plan === 'monthly' ? 1 : plan === 'quarterly' ? 3 : 12
    const now = Date.now()
    setEnt((p) => ({ ...p, proPlan: plan, proStartedAt: now, proExpiresAt: now + months * 30 * DAY }))
    setPaywallOpen(false)
  }, [])

  // 兑换码开通（个人支付宝/微信收款的落地路径）
  const redeem = useCallback(async (code: string) => {
    if (isUsed(code)) return { ok: false, msg: '该兑换码已被使用' }
    const r = await verifyCode(code)
    if (!r.ok || !r.plan) return { ok: false, msg: r.reason ?? '兑换失败' }
    markUsed(code)
    const months = PLAN_MONTHS[r.plan]
    const now = Date.now()
    setEnt((p) => ({ ...p, proPlan: r.plan, proStartedAt: now, proExpiresAt: now + months * 30 * DAY }))
    setPaywallOpen(false)
    const label = r.plan === 'monthly' ? '月度' : r.plan === 'quarterly' ? '季度' : '年度'
    return { ok: true, msg: `已开通 Pro · ${label}` }
  }, [])

  // ⛳️ BACKEND SEAM: 真要防盗用请把发码移到服务端（凭支付回调铸造）。
  const mintCode = useCallback((plan: Plan) => genCode(plan), [])

  const restore = useCallback(() => {
    // ⛳️ BACKEND SEAM: 向后端/RevenueCat 查询当前账号的有效订阅并回填。
  }, [])

  const cancel = useCallback(() => {
    setEnt((p) => ({ ...p, proPlan: undefined, proStartedAt: undefined, proExpiresAt: undefined }))
  }, [])

  // —— 演示助手（生产可删）——
  const expireTrial = useCallback(() => {
    setEnt((p) => ({ ...p, trialStartedAt: Date.now() - (TRIAL_DAYS + 1) * DAY, proPlan: undefined, proStartedAt: undefined, proExpiresAt: undefined }))
  }, [])
  const resetAll = useCallback(() => {
    setEnt((p) => ({ region: p.region, aiEnhance: false }))
  }, [])

  const openPaywall = useCallback((reason?: string) => {
    setPaywallReason(reason)
    setPaywallOpen(true)
  }, [])
  const closePaywall = useCallback(() => setPaywallOpen(false), [])

  const value = useMemo<Ctx>(() => {
    const status = deriveStatus(ent)
    return {
      ent,
      status,
      isPro: status === 'pro' || status === 'trial',
      daysLeft: trialDaysLeft(ent),
      region: ent.region,
      aiEnhance: ent.aiEnhance,
      startTrial,
      subscribe,
      redeem,
      mintCode,
      restore,
      cancel,
      expireTrial,
      resetAll,
      setRegion: (r) => update({ region: r }),
      setAiEnhance: (v) => update({ aiEnhance: v }),
      paywallOpen,
      paywallReason,
      openPaywall,
      closePaywall,
    }
  }, [ent, paywallOpen, paywallReason, startTrial, subscribe, redeem, mintCode, restore, cancel, expireTrial, resetAll, update, openPaywall, closePaywall])

  return <EntitlementContext.Provider value={value}>{children}</EntitlementContext.Provider>
}

export function useEntitlement(): Ctx {
  const ctx = useContext(EntitlementContext)
  if (!ctx) throw new Error('useEntitlement must be used within EntitlementProvider')
  return ctx
}

// 被 Pro 门控的周期（统计/健康里的 季度/半年/年度）
export const PRO_PERIODS = new Set(['quarter', 'half', 'year'])
