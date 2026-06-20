import { supabase, SUPABASE_READY } from './supabase'
import type { Expense } from '../types'

const LAST_SYNC_KEY = 'huaji.lastSync.v1'

function setLastSync(): void {
  localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString())
}

export async function pushToCloud(records: Expense[]): Promise<{ ok: boolean; msg: string; count: number }> {
  if (!SUPABASE_READY) return { ok: false, msg: '云端未配置', count: 0 }
  const { data: sess } = await supabase.auth.getSession()
  if (!sess.session) return { ok: false, msg: '请先登录', count: 0 }

  const userId = sess.session.user.id
  const rows = records.map(r => ({
    user_id: userId,
    record_id: r.id,
    data: r,
    updated_at: new Date().toISOString(),
    deleted: false,
  }))

  const BATCH = 200
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH)
    const { error } = await supabase.from('records').upsert(batch, { onConflict: 'user_id,record_id' })
    if (error) {
      if (/relation.*does not exist/i.test(error.message)) {
        return { ok: false, msg: '云端表未创建，请先在 Supabase 运行迁移 SQL', count: 0 }
      }
      return { ok: false, msg: error.message, count: 0 }
    }
  }
  setLastSync()
  return { ok: true, msg: `已同步 ${records.length} 条记录`, count: records.length }
}

export async function pullFromCloud(): Promise<{ ok: boolean; records: Expense[]; msg: string }> {
  if (!SUPABASE_READY) return { ok: false, records: [], msg: '云端未配置' }
  const { data: sess } = await supabase.auth.getSession()
  if (!sess.session) return { ok: false, records: [], msg: '请先登录' }

  const { data, error } = await supabase
    .from('records')
    .select('record_id, data, deleted')
    .eq('user_id', sess.session.user.id)

  if (error) {
    if (/relation.*does not exist/i.test(error.message)) {
      return { ok: false, records: [], msg: '云端表未创建，请先在 Supabase 运行迁移 SQL' }
    }
    return { ok: false, records: [], msg: error.message }
  }

  const records = (data ?? [])
    .filter(r => !r.deleted)
    .map(r => ({ type: 'expense' as const, ...r.data }) as Expense)

  setLastSync()
  return { ok: true, records, msg: `已拉取 ${records.length} 条记录` }
}

export function mergeRecords(local: Expense[], remote: Expense[]): Expense[] {
  const map = new Map<string, Expense>()
  for (const r of remote) map.set(r.id, r)
  for (const l of local) {
    const existing = map.get(l.id)
    if (!existing || l.createdAt >= existing.createdAt) {
      map.set(l.id, l)
    }
  }
  return [...map.values()]
}

export function getLastSyncDisplay(): string | null {
  const ts = localStorage.getItem(LAST_SYNC_KEY)
  if (!ts) return null
  const d = new Date(ts)
  if (isNaN(d.getTime())) return null
  const now = Date.now()
  const diff = now - d.getTime()
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}
