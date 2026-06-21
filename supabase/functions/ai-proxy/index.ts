// ============================================================================
// 花迹 · AI 代理 Edge Function
//
// 作用：把 AI 调用放到服务端，apikey 永不下发到客户端。
//   前端(登录态) → 调本函数 → 函数用 service_role 读 app_config 里的 key
//   → 带 key 请求 AI 厂商 → 把结果返回前端。
//
// 部署：supabase functions deploy ai-proxy
//   （Edge Function 运行时自带 SUPABASE_URL / SUPABASE_ANON_KEY /
//     SUPABASE_SERVICE_ROLE_KEY 环境变量，无需手动配置）
// ============================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const DEFAULT_BASE = 'https://api.xiaomimimo.com/v1/chat/completions'
const DEFAULT_MODEL = 'mimo-v2-flash'

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // 1) 校验调用者必须是已登录用户
    const authHeader = req.headers.get('Authorization') ?? ''
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } })
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ error: '请先登录' }, 401)

    // 2) 用 service_role 读取 AI 配置（绕过 RLS，key 只在服务端可见）
    const admin = createClient(SUPABASE_URL, SERVICE_KEY)
    const { data: rows } = await admin
      .from('app_config')
      .select('key,value')
      .in('key', ['ai_api_key', 'ai_base_url', 'ai_model'])
    const cfg: Record<string, string> = {}
    for (const r of rows ?? []) cfg[r.key] = r.value
    const apiKey = cfg['ai_api_key']
    const baseURL = cfg['ai_base_url'] || DEFAULT_BASE
    const model = cfg['ai_model'] || DEFAULT_MODEL
    if (!apiKey) return json({ error: 'AI 服务未配置' }, 200)

    // 3) 转发到 AI 厂商
    const body = await req.json().catch(() => ({}))
    if (!Array.isArray(body?.messages)) return json({ error: '缺少 messages' }, 400)

    const upstream = await fetch(baseURL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: typeof body.model === 'string' && body.model ? body.model : model,
        messages: body.messages,
        temperature: typeof body.temperature === 'number' ? body.temperature : 0.3,
        max_tokens: typeof body.max_tokens === 'number' ? body.max_tokens : 1024,
      }),
    })

    const data = await upstream.json().catch(() => null)
    if (!upstream.ok) return json({ error: `AI 请求失败 (${upstream.status})`, detail: data }, 200)
    return json(data, 200)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : '服务端错误' }, 200)
  }
})
