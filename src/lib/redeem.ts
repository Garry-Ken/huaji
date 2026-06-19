import type { Plan } from './entitlement'

// ============================================================================
// 兑换码 (Redeem Code)
//
// 为什么需要它：个人支付宝/微信「收款码」只能收钱，拿不到「谁付了哪个套餐」的
// 回调，无法自动开通。所以流程是：
//   用户扫你的收款码付款 → 你用「管理员发码」生成一个兑换码发给他 →
//   他在 App 里输入兑换码 → 解锁 Pro。
//
// 这样无需营业执照、无需后端，就能用个人收款今天真实收钱。
//
// ⚠️ MVP 安全性：校验在本地用 Web Crypto HMAC，SECRET 打包在前端——能挡住
// 随手乱猜/改码，但技术用户仍可逆向。要真正防盗用/防跨设备重复使用，
// 把 genCode/verifyCode 挪到服务端（⛳️ BACKEND SEAM）。
// ============================================================================

const SECRET = 'huaji-redeem-mvp-v1' // ⛳️ 上线请改掉并移到服务端
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // 去掉易混字符
const SHORT: Record<Plan, string> = { monthly: 'M', quarterly: 'Q', annual: 'Y' }
const FROM_SHORT: Record<string, Plan> = { M: 'monthly', Q: 'quarterly', Y: 'annual' }
export const PLAN_MONTHS: Record<Plan, number> = { monthly: 1, quarterly: 3, annual: 12 }

const USED_KEY = 'huaji.usedCodes.v1'

function buf(s: string): ArrayBuffer {
  // TextEncoder.encode 返回的视图恰好覆盖整个 buffer，可直接取 .buffer
  return new TextEncoder().encode(s).buffer as ArrayBuffer
}

async function hmacHex(msg: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', buf(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, buf(msg))
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function randNonce(n = 6): string {
  const arr = crypto.getRandomValues(new Uint8Array(n))
  return [...arr].map((x) => ALPHABET[x % ALPHABET.length]).join('')
}

/** 管理员：为某套餐铸造一个兑换码 */
export async function genCode(plan: Plan): Promise<string> {
  const nonce = randNonce()
  const sig = (await hmacHex(`${plan}:${nonce}`)).slice(0, 6).toUpperCase()
  return `HJ-${SHORT[plan]}-${nonce}-${sig}`
}

export interface VerifyResult {
  ok: boolean
  plan?: Plan
  months?: number
  reason?: string
}

/** 用户：校验兑换码（不消费） */
export async function verifyCode(input: string): Promise<VerifyResult> {
  const code = input.trim().toUpperCase()
  const m = code.match(/^HJ-([MQY])-([A-Z2-9]{6})-([A-F0-9]{6})$/)
  if (!m) return { ok: false, reason: '兑换码格式不正确' }
  const plan = FROM_SHORT[m[1]]
  const expect = (await hmacHex(`${plan}:${m[2]}`)).slice(0, 6).toUpperCase()
  if (expect !== m[3]) return { ok: false, reason: '兑换码无效' }
  return { ok: true, plan, months: PLAN_MONTHS[plan] }
}

export function isUsed(code: string): boolean {
  try {
    const arr: string[] = JSON.parse(localStorage.getItem(USED_KEY) || '[]')
    return arr.includes(code.trim().toUpperCase())
  } catch {
    return false
  }
}

export function markUsed(code: string): void {
  try {
    const arr: string[] = JSON.parse(localStorage.getItem(USED_KEY) || '[]')
    arr.push(code.trim().toUpperCase())
    localStorage.setItem(USED_KEY, JSON.stringify(arr))
  } catch {
    /* ignore */
  }
}
