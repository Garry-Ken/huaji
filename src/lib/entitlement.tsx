import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { supabase } from './supabase'
import { hasUserAi } from './aiConfig'

// ============================================================================
// 权益中心 (Entitlement) — 服务端校验版
//
// Pro 权益由 Supabase 服务器派发并校验（绑定账号、跨设备、改本地无效）。
// 免费版与 7 天试用仍是本地（试用是“免费赠送”，本地即可，不涉及收费安全）。
//
//   登录   = Supabase 邮箱验证码（OTP）
//   权益读 = rpc my_entitlement（到期自动判为 free）
//   兑换   = rpc redeem_code（需登录，服务端原子核销）
//   发码   = rpc mint_code（仅店主）
//   开通   = rpc admin_grant（仅店主，按邮箱）
// ============================================================================

const DAY = 86400000
const TRIAL_DAYS = 7
const STORE_KEY = 'huaji.entitlement.v1' // 仅存本地偏好 + 试用开始时间

export type Tier = 'pro' | 'ultra'
export type Plan = 'annual' | 'lifetime'
export type Region = 'cn' | 'intl'
export type Status = 'free' | 'trial' | 'pro' | 'ultra' | 'expired'

interface LocalPrefs {
  region: Region
  trialStartedAt?: number
  aiEnhance: boolean
}

// —— 定价（三级会员 · 季度 8 折 · 年度 7 折）——
export interface PlanInfo {
  id: Plan
  label: string
  total: number
  months: number
  perMonth: number
  saveLabel?: string
  badge?: string
}

export interface TierInfo {
  tier: Tier
  name: string
  tagline: string
  features: string[]
  highlight?: boolean
  gradient: string
}

// 定价：Pro 年付 / Ultra 年付 / 永久买断(=Ultra 永久)。云同步·多账本免费。
const RAW = {
  cn:   { sym: '¥', pro: { annual: 60 },  ultra: { annual: 168, lifetime: 199 } },
  intl: { sym: '$', pro: { annual: 12 },  ultra: { annual: 28,  lifetime: 33 } },
} as const

export const TIER_INFO: TierInfo[] = [
  {
    tier: 'pro', name: 'Pro', tagline: '智能解析',
    gradient: 'linear-gradient(135deg,#0a84ff,#30d158)',
    features: ['AI 智能增强解析', '季度/半年/年度深度分析', '数据导入导出', '（云同步·多账本·云端恢复 已免费）'],
  },
  {
    tier: 'ultra', name: 'Ultra', tagline: 'AI 营养师', highlight: true,
    gradient: 'linear-gradient(135deg,#af52de,#ff375f)',
    features: ['包含 Pro 全部功能', 'AI 饮食对话（营养师）', '无限数据导入导出', '优先客服支持'],
  },
]

export function pricing(region: Region, tier: Tier = 'pro'): { sym: string; plans: PlanInfo[] } {
  const r = RAW[region][tier] as { annual: number; lifetime?: number }
  const round = (n: number) => Math.round(n * 100) / 100
  const plans: PlanInfo[] = [
    { id: 'annual', label: '年付', total: round(r.annual), months: 12, perMonth: round(r.annual / 12) },
  ]
  if (r.lifetime != null) {
    plans.push({ id: 'lifetime', label: '永久买断', total: round(r.lifetime), months: 0, perMonth: 0, badge: '最划算', saveLabel: '一次付费 · 永久有效' })
  }
  return { sym: RAW[region].sym, plans }
}

// 旧版兼容：无参调用返回 Pro 定价
export function pricingLegacy(region: Region) { return pricing(region, 'pro') }

export function formatPrice(region: Region, n: number): string {
  const sym = RAW[region].sym
  const isInt = Math.abs(n - Math.round(n)) < 1e-9
  return sym + (isInt ? String(Math.round(n)) : n.toFixed(2))
}

// ---------- 本地偏好持久化 ----------
function loadLocal(): LocalPrefs {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (raw) return { region: 'cn', aiEnhance: false, ...JSON.parse(raw) }
  } catch {
    /* ignore */
  }
  const region: Region = typeof navigator !== 'undefined' && /^zh/i.test(navigator.language) ? 'cn' : 'intl'
  return { region, aiEnhance: false }
}
function persistLocal(p: LocalPrefs) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(p))
  } catch {
    /* ignore */
  }
}

// ---------- 错误信息中文化 ----------
function zhAuth(m: string): string {
  if (/rate|too many|seconds|limit/i.test(m)) return '发送太频繁，请过一会儿再试'
  if (/invalid.*credentials|invalid.*password/i.test(m)) return '邮箱或密码错误'
  if (/invalid|expired|token|otp/i.test(m)) return '验证码错误或已过期'
  if (/password.*(?:short|weak|length|at least)/i.test(m)) return '密码太短，至少 6 位'
  if (/same.*password|identical/i.test(m)) return '新密码不能与旧密码相同'
  if (/email/i.test(m)) return '邮箱格式不正确'
  return m || '出错了，请重试'
}
function zhRpc(m: string): string {
  if (/already used/i.test(m)) return '该兑换码已被使用'
  if (/invalid code/i.test(m)) return '兑换码无效'
  if (/login required/i.test(m)) return '请先登录'
  if (/not authorized/i.test(m)) return '无权限（仅店主可操作）'
  if (/user not found/i.test(m)) return '该邮箱还没登录过本应用'
  if (/invalid plan/i.test(m)) return '套餐无效'
  return m || '操作失败'
}

interface ServerEnt {
  plan?: Plan
  tier?: Tier
  expiresAt?: number
}

export interface AppUser {
  id: string
  email: string
}

interface Ctx {
  region: Region
  aiEnhance: boolean
  setRegion: (r: Region) => void
  setAiEnhance: (v: boolean) => void
  // 状态
  status: Status
  tier?: Tier
  isPlus: boolean
  isPro: boolean
  isUltra: boolean
  isLifetime: boolean
  daysLeft: number
  proPlan?: Plan
  proExpiresAt?: number
  // 自带 API key（任何用户填了自己的 key 即可免费用 AI）
  hasOwnAiKey: boolean
  canEnhance: boolean   // AI 智能增强解析：Pro+ 或 自带 key
  canDietChat: boolean  // AI 饮食对话：Ultra 或 自带 key
  notifyOwnKeyChanged: () => void
  // 账号
  user: AppUser | null
  isAdmin: boolean
  authReady: boolean
  sendOtp: (email: string) => Promise<{ ok: boolean; msg: string }>
  verifyOtp: (email: string, token: string) => Promise<{ ok: boolean; msg: string }>
  signInWithPassword: (email: string, password: string) => Promise<{ ok: boolean; msg: string }>
  resetPassword: (email: string) => Promise<{ ok: boolean; msg: string }>
  updatePassword: (password: string) => Promise<{ ok: boolean; msg: string }>
  passwordRecovery: boolean
  dismissPasswordRecovery: () => void
  signOut: () => Promise<void>
  // 操作
  startTrial: () => void
  redeem: (code: string) => Promise<{ ok: boolean; msg: string }>
  mintCode: (plan: Plan, tier?: Tier) => Promise<string>
  mintCodes: (plan: Plan, count?: number, tier?: Tier) => Promise<string[]>
  adminGrant: (email: string, plan: Plan, tier?: Tier) => Promise<{ ok: boolean; msg: string }>
  refresh: () => Promise<void>
  restore: () => void
  resetLocal: () => void
  // 付费墙
  paywallOpen: boolean
  paywallReason?: string
  openPaywall: (reason?: string) => void
  closePaywall: () => void
  // 登录弹窗
  loginOpen: boolean
  openLogin: () => void
  closeLogin: () => void
}

const EntitlementContext = createContext<Ctx | null>(null)

export function EntitlementProvider({ children }: { children: ReactNode }) {
  const [local, setLocal] = useState<LocalPrefs>(() => loadLocal())
  const [user, setUser] = useState<AppUser | null>(null)
  const [serverEnt, setServerEnt] = useState<ServerEnt | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [authReady, setAuthReady] = useState(false)
  const [paywallOpen, setPaywallOpen] = useState(false)
  const [paywallReason, setPaywallReason] = useState<string | undefined>()
  const [loginOpen, setLoginOpen] = useState(false)
  const [passwordRecovery, setPasswordRecovery] = useState(false)
  const [ownKeyTick, setOwnKeyTick] = useState(0) // 自带 key 变更后触发重算

  useEffect(() => persistLocal(local), [local])

  const refresh = useCallback(async () => {
    const { data: sess } = await supabase.auth.getSession()
    const u = sess.session?.user
    if (!u) {
      setUser(null)
      setServerEnt(null)
      setIsAdmin(false)
      setAuthReady(true)
      return
    }
    setUser({ id: u.id, email: u.email ?? '' })
    try {
      const [entRes, admRes] = await Promise.all([supabase.rpc('my_entitlement'), supabase.rpc('is_admin')])
      const rows = entRes.data as Array<{ plan: string | null; status: string; expires_at: string | null; tier?: string | null }> | null
      const row = Array.isArray(rows) ? rows[0] : null
      setServerEnt(row ? { plan: (row.plan ?? undefined) as Plan | undefined, tier: (row.tier ?? 'pro') as Tier, expiresAt: row.expires_at ? new Date(row.expires_at).getTime() : undefined } : null)
      setIsAdmin(admRes.data === true)
    } catch {
      /* 离线：保留上次已知状态 */
    }
    setAuthReady(true)
  }, [])

  useEffect(() => {
    refresh()
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true)
      refresh()
    })
    return () => sub.subscription.unsubscribe()
  }, [refresh])

  // —— 账号 ——
  const sendOtp = useCallback(async (email: string) => {
    const redirectTo = typeof window !== 'undefined' ? window.location.origin : 'https://huaji.pages.dev'
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true, emailRedirectTo: redirectTo } })
    return error ? { ok: false, msg: zhAuth(error.message) } : { ok: true, msg: '验证码已发到邮箱，请查收（含垃圾箱）' }
  }, [])

  const verifyOtp = useCallback(
    async (email: string, token: string) => {
      const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: token.trim(), type: 'email' })
      if (error) return { ok: false, msg: zhAuth(error.message) }
      await refresh()
      setLoginOpen(false)
      return { ok: true, msg: '登录成功' }
    },
    [refresh],
  )

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) return { ok: false, msg: zhAuth(error.message) }
    await refresh()
    setLoginOpen(false)
    return { ok: true, msg: '登录成功' }
  }, [refresh])

  const resetPassword = useCallback(async (email: string) => {
    const redirectTo = typeof window !== 'undefined' ? window.location.origin : 'https://huaji.pages.dev'
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo })
    return error ? { ok: false, msg: zhAuth(error.message) } : { ok: true, msg: '重置链接已发到邮箱，请查收' }
  }, [])

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password })
    if (error) return { ok: false, msg: zhAuth(error.message) }
    setPasswordRecovery(false)
    return { ok: true, msg: '密码已更新' }
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setUser(null)
    setServerEnt(null)
    setIsAdmin(false)
  }, [])

  // —— 操作 ——
  const startTrial = useCallback(() => {
    setLocal((p) => (p.trialStartedAt ? p : { ...p, trialStartedAt: Date.now() }))
    setPaywallOpen(false)
  }, [])

  const redeem = useCallback(
    async (code: string) => {
      const { data: sess } = await supabase.auth.getSession()
      if (!sess.session) {
        setLoginOpen(true)
        return { ok: false, msg: '请先登录后再兑换' }
      }
      const { data, error } = await supabase.rpc('redeem_code', { p_code: code.trim() })
      if (error) return { ok: false, msg: zhRpc(error.message) }
      await refresh()
      setPaywallOpen(false)
      const row = Array.isArray(data) ? data[0] : null
      const tierName = TIER_INFO.find(t => t.tier === (row?.tier as Tier))?.name ?? '会员'
      return { ok: true, msg: `已开通 ${tierName} 🎉` }
    },
    [refresh],
  )

  const mintCode = useCallback(async (plan: Plan, tier: Tier = 'pro') => {
    const { data, error } = await supabase.rpc('mint_code', { p_plan: plan, p_tier: tier })
    if (error) throw new Error(zhRpc(error.message))
    return data as string
  }, [])

  const mintCodes = useCallback(async (plan: Plan, count = 5, tier: Tier = 'pro') => {
    const { data, error } = await supabase.rpc('mint_codes', { p_plan: plan, p_count: count, p_tier: tier })
    if (error) throw new Error(zhRpc(error.message))
    return data as string[]
  }, [])

  const adminGrant = useCallback(
    async (email: string, plan: Plan, tier: Tier = 'pro') => {
      const { error } = await supabase.rpc('admin_grant', { p_email: email.trim(), p_plan: plan, p_tier: tier })
      if (error) return { ok: false, msg: zhRpc(error.message) }
      await refresh()
      const tierName = TIER_INFO.find(t => t.tier === tier)?.name ?? 'Pro'
      return { ok: true, msg: `已为 ${email.trim()} 开通 ${tierName}` }
    },
    [refresh],
  )

  const restore = useCallback(() => setLoginOpen(true), [])
  const resetLocal = useCallback(() => setLocal((p) => ({ region: p.region, aiEnhance: false })), [])

  const openPaywall = useCallback((reason?: string) => {
    setPaywallReason(reason)
    setPaywallOpen(true)
  }, [])

  const value = useMemo<Ctx>(() => {
    const now = Date.now()
    const trialEnds = local.trialStartedAt ? local.trialStartedAt + TRIAL_DAYS * DAY : 0
    const trialActive = trialEnds > now
    const serverActive = !!(serverEnt && serverEnt.expiresAt && serverEnt.expiresAt > now) || isAdmin
    // 店主恒为最高级 Ultra（无限使用），不需要兑换/开通
    const activeTier: Tier | undefined = isAdmin ? 'ultra' : serverActive ? (serverEnt?.tier ?? 'pro') : undefined
    const status: Status = serverActive ? (activeTier ?? 'pro') : trialActive ? 'trial' : local.trialStartedAt ? 'expired' : 'free'
    const daysLeft = local.trialStartedAt ? Math.max(0, Math.ceil((trialEnds - now) / DAY)) : 0
    const tierRank = (t?: Tier) => t === 'ultra' ? 3 : t === 'pro' ? 2 : 0
    const effectiveTier = serverActive ? activeTier : trialActive ? 'pro' as Tier : undefined
    const rank = tierRank(effectiveTier)
    const isPro = rank >= 2
    const isUltra = rank >= 3
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    ownKeyTick
    const hasOwnAiKey = hasUserAi()
    // 永久 = lifetime 计划（服务端 expiresAt 给到极远期）
    const isLifetime = serverEnt?.plan === 'lifetime' || (serverActive && !isAdmin && !!serverEnt?.expiresAt && serverEnt.expiresAt - now > 50 * 365 * DAY)
    return {
      region: local.region,
      aiEnhance: local.aiEnhance,
      setRegion: (r) => setLocal((p) => ({ ...p, region: r })),
      setAiEnhance: (v) => setLocal((p) => ({ ...p, aiEnhance: v })),
      status,
      tier: effectiveTier,
      isPlus: isPro,
      isPro,
      isUltra,
      isLifetime,
      hasOwnAiKey,
      canEnhance: isPro || hasOwnAiKey,
      canDietChat: isUltra || hasOwnAiKey,
      notifyOwnKeyChanged: () => setOwnKeyTick((t) => t + 1),
      daysLeft,
      proPlan: serverEnt?.plan,
      proExpiresAt: serverActive ? serverEnt?.expiresAt : undefined,
      user,
      isAdmin,
      authReady,
      sendOtp,
      verifyOtp,
      signInWithPassword,
      resetPassword,
      updatePassword,
      passwordRecovery,
      dismissPasswordRecovery: () => setPasswordRecovery(false),
      signOut,
      startTrial,
      redeem,
      mintCode,
      mintCodes,
      adminGrant,
      refresh,
      restore,
      resetLocal,
      paywallOpen,
      paywallReason,
      openPaywall,
      closePaywall: () => setPaywallOpen(false),
      loginOpen,
      openLogin: () => setLoginOpen(true),
      closeLogin: () => setLoginOpen(false),
    }
  }, [local, user, serverEnt, isAdmin, authReady, ownKeyTick, paywallOpen, paywallReason, loginOpen, passwordRecovery, sendOtp, verifyOtp, signInWithPassword, resetPassword, updatePassword, signOut, startTrial, redeem, mintCode, mintCodes, adminGrant, refresh, restore, resetLocal, openPaywall])

  return <EntitlementContext.Provider value={value}>{children}</EntitlementContext.Provider>
}

export function useEntitlement(): Ctx {
  const ctx = useContext(EntitlementContext)
  if (!ctx) throw new Error('useEntitlement must be used within EntitlementProvider')
  return ctx
}

// 被 Pro 门控的周期（统计/健康里的 季度/半年/年度）
export const PRO_PERIODS = new Set(['quarter', 'half', 'year'])
