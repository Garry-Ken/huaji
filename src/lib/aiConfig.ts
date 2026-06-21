import { supabase } from './supabase'

// ============================================================================
// AI 配置中心 — 从 Supabase app_config 读取，店主可在「我的」页 web 端修改。
//   ai_api_key  / ai_base_url / ai_model
// 未配置时回退到默认值。写入走 admin_set_config（仅店主，服务端校验）。
// ============================================================================

export interface AiConfig {
  apiKey: string
  baseURL: string
  model: string
}

export const AI_DEFAULTS: Omit<AiConfig, 'apiKey'> = {
  baseURL: 'https://api.xiaomimimo.com/v1/chat/completions',
  model: 'mimo-v2-flash',
}

const KEY_MAP = { apiKey: 'ai_api_key', baseURL: 'ai_base_url', model: 'ai_model' } as const

// 缓存带 TTL：店主在 web 端改了 key，其它端(含已打开的 app)最多 TTL 后自动拉到新值，无需重启
const CACHE_TTL = 3 * 60 * 1000 // 3 分钟
let cache: AiConfig | null = null
let cachedAt = 0

export async function loadAiConfig(force = false): Promise<AiConfig> {
  if (cache && !force && Date.now() - cachedAt < CACHE_TTL) return cache
  try {
    const { data } = await supabase
      .from('app_config')
      .select('key,value')
      .in('key', ['ai_api_key', 'ai_base_url', 'ai_model'])
    const map = new Map<string, string>((data ?? []).map((r: { key: string; value: string }) => [r.key, r.value]))
    cache = {
      apiKey: map.get('ai_api_key') || '',
      baseURL: map.get('ai_base_url') || AI_DEFAULTS.baseURL,
      model: map.get('ai_model') || AI_DEFAULTS.model,
    }
    cachedAt = Date.now()
  } catch {
    cache = cache ?? { apiKey: '', ...AI_DEFAULTS }
  }
  return cache
}

/** 店主保存 AI 配置（按字段逐个 upsert，空字符串= 不改） */
export async function saveAiConfig(cfg: Partial<AiConfig>): Promise<{ ok: boolean; msg: string }> {
  const entries = (Object.keys(KEY_MAP) as (keyof AiConfig)[])
    .filter((f) => typeof cfg[f] === 'string')
    .map((f) => [KEY_MAP[f], cfg[f] as string] as const)
  for (const [key, value] of entries) {
    const { error } = await supabase.rpc('admin_set_config', { p_key: key, p_value: value })
    if (error) {
      if (/not authorized/i.test(error.message)) return { ok: false, msg: '无权限（仅店主可操作）' }
      if (/Could not find the function/i.test(error.message)) return { ok: false, msg: '请先在 Supabase 重跑 schema.sql' }
      return { ok: false, msg: error.message }
    }
  }
  cache = null // 失效缓存，下次调用 AI 时重新拉取
  cachedAt = 0
  return { ok: true, msg: 'AI 配置已保存' }
}

export function invalidateAiConfig() {
  cache = null
  cachedAt = 0
}

// ---------- 通过 Edge Function 代理调用 AI（key 不下发到客户端）----------
export interface AiProxyPayload {
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[]
  temperature?: number
  max_tokens?: number
  model?: string
}

export interface AiProxyResult {
  content: string
  tokens: number
}

/** 调用服务端 AI 代理（店主共享 key）。返回 {content, tokens} 或 {error}。 */
export async function callAiProxy(payload: AiProxyPayload): Promise<AiProxyResult | { error: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('ai-proxy', { body: payload })
    if (error) return { error: '网络错误，请稍后重试' }
    if (data?.error) return { error: data.error as string }
    const content = data?.choices?.[0]?.message?.content?.trim()
    if (!content) return { error: '未收到回复' }
    return { content, tokens: data?.usage?.total_tokens ?? 0 }
  } catch (e) {
    return { error: e instanceof Error ? e.message : '网络错误' }
  }
}

// ============================================================================
// 用户自带 API key —— 任何用户填了自己的 key 即可免费用 AI（存本地，直连厂商，
// 不经店主代理、不烧店主额度）。这是用户自己的 key、自己的设备，本地存放可接受。
// ============================================================================
const USER_AI_KEY = 'huaji.userAi.v1'

export interface UserAi { apiKey: string; baseURL: string; model: string }

export function loadUserAi(): UserAi {
  try {
    const raw = localStorage.getItem(USER_AI_KEY)
    if (raw) {
      const j = JSON.parse(raw)
      return { apiKey: j.apiKey || '', baseURL: j.baseURL || AI_DEFAULTS.baseURL, model: j.model || AI_DEFAULTS.model }
    }
  } catch { /* ignore */ }
  return { apiKey: '', baseURL: AI_DEFAULTS.baseURL, model: AI_DEFAULTS.model }
}

export function saveUserAi(cfg: UserAi): void {
  try { localStorage.setItem(USER_AI_KEY, JSON.stringify(cfg)) } catch { /* ignore */ }
}

export function clearUserAi(): void {
  try { localStorage.removeItem(USER_AI_KEY) } catch { /* ignore */ }
}

export function hasUserAi(): boolean {
  return !!loadUserAi().apiKey
}

/** 用自带 key 直连厂商。 */
async function callUserAi(u: UserAi, payload: AiProxyPayload): Promise<AiProxyResult | { error: string }> {
  try {
    const res = await fetch(u.baseURL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${u.apiKey}` },
      body: JSON.stringify({
        model: payload.model || u.model,
        messages: payload.messages,
        temperature: payload.temperature ?? 0.3,
        max_tokens: payload.max_tokens ?? 1024,
      }),
    })
    if (!res.ok) return { error: `AI 请求失败 (${res.status})` }
    const data = await res.json()
    const content = data?.choices?.[0]?.message?.content?.trim()
    if (!content) return { error: '未收到回复' }
    return { content, tokens: data?.usage?.total_tokens ?? 0 }
  } catch (e) {
    return { error: e instanceof Error ? e.message : '网络错误' }
  }
}

/** 统一 AI 调用：有自带 key 走自带(直连)，否则走店主代理。 */
export async function callAi(payload: AiProxyPayload): Promise<AiProxyResult | { error: string }> {
  const u = loadUserAi()
  if (u.apiKey) return callUserAi(u, payload)
  return callAiProxy(payload)
}
