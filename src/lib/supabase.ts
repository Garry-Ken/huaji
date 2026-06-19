import { createClient } from '@supabase/supabase-js'

// ============================================================================
// Supabase 客户端
//
// 下面两个参数是 Supabase 的【可公开】参数：
//   - URL 与 publishable key 设计上就嵌在客户端里、对所有人可见。
//   - 安全性由数据库的「行级权限(RLS) + 服务端函数」保证，不靠这个 key 保密。
// 真正不能泄露的是带 service_role / secret 字样的那个 —— 它绝不会出现在客户端代码里。
// ============================================================================
const SUPABASE_URL = 'https://vqjpxmgctifgudxanbnm.supabase.co'
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_B-M6LVznfVoh6ys1GZ0ntw_KnyxjGQJ'

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true, // 网页端 magic-link 回跳；App 端走 6 位验证码
  },
})

export const SUPABASE_READY = /^https:\/\/[a-z0-9]+\.supabase\.co$/.test(SUPABASE_URL)
