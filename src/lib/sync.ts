import { supabase, SUPABASE_READY } from './supabase'
import type { Expense, Ledger } from '../types'

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

// 后写赢：以 updatedAt(无则回退 createdAt) 较大者为准，让编辑也能跨端同步
function stamp(e: { updatedAt?: number; createdAt: number }): number {
  return e.updatedAt ?? e.createdAt
}

export function mergeRecords(local: Expense[], remote: Expense[]): Expense[] {
  const map = new Map<string, Expense>()
  for (const r of remote) map.set(r.id, r)
  for (const l of local) {
    const existing = map.get(l.id)
    if (!existing || stamp(l) >= stamp(existing)) map.set(l.id, l)
  }
  return [...map.values()]
}

export function mergeLedgers(local: Ledger[], remote: Ledger[]): Ledger[] {
  const map = new Map<string, Ledger>()
  for (const r of remote) map.set(r.id, r)
  for (const l of local) {
    const existing = map.get(l.id)
    if (!existing || stamp(l) >= stamp(existing)) map.set(l.id, l)
  }
  return [...map.values()]
}

export async function syncDeleteToCloud(ids: string[]): Promise<{ ok: boolean; msg: string }> {
  if (!SUPABASE_READY) return { ok: false, msg: '云端未配置' }
  const { data: sess } = await supabase.auth.getSession()
  if (!sess.session) return { ok: false, msg: '请先登录' }

  const { error } = await supabase
    .from('records')
    .update({ deleted: true, updated_at: new Date().toISOString() })
    .eq('user_id', sess.session.user.id)
    .in('record_id', ids)

  if (error) return { ok: false, msg: error.message }
  return { ok: true, msg: `已标记 ${ids.length} 条为已删除` }
}

export async function pullDeletedFromCloud(): Promise<{ ok: boolean; records: Expense[]; msg: string }> {
  if (!SUPABASE_READY) return { ok: false, records: [], msg: '云端未配置' }
  const { data: sess } = await supabase.auth.getSession()
  if (!sess.session) return { ok: false, records: [], msg: '请先登录' }

  const { data, error } = await supabase
    .from('records')
    .select('record_id, data, deleted')
    .eq('user_id', sess.session.user.id)
    .eq('deleted', true)

  if (error) return { ok: false, records: [], msg: error.message }

  const records = (data ?? []).map(r => ({ type: 'expense' as const, ...r.data }) as Expense)
  return { ok: true, records, msg: `找到 ${records.length} 条已删除记录` }
}

export async function restoreFromCloud(ids: string[]): Promise<{ ok: boolean; msg: string }> {
  if (!SUPABASE_READY) return { ok: false, msg: '云端未配置' }
  const { data: sess } = await supabase.auth.getSession()
  if (!sess.session) return { ok: false, msg: '请先登录' }

  const { error } = await supabase
    .from('records')
    .update({ deleted: false, updated_at: new Date().toISOString() })
    .eq('user_id', sess.session.user.id)
    .in('record_id', ids)

  if (error) return { ok: false, msg: error.message }
  return { ok: true, msg: `已恢复 ${ids.length} 条记录` }
}

let syncTimer: ReturnType<typeof setTimeout> | null = null
let syncStatusCb: ((s: 'idle' | 'syncing' | 'done' | 'error') => void) | null = null

export function onSyncStatus(cb: (s: 'idle' | 'syncing' | 'done' | 'error') => void): void {
  syncStatusCb = cb
}

export async function autoSync(records: Expense[]): Promise<void> {
  if (syncTimer) clearTimeout(syncTimer)
  syncTimer = setTimeout(async () => {
    syncTimer = null
    syncStatusCb?.('syncing')
    const res = await pushToCloud(records)
    syncStatusCb?.(res.ok ? 'done' : 'error')
    if (res.ok) setTimeout(() => syncStatusCb?.('idle'), 2000)
  }, 3000)
}

// ---------- 账本同步（与 records 同构）----------
export async function pushLedgers(ledgers: Ledger[]): Promise<{ ok: boolean; msg: string }> {
  if (!SUPABASE_READY) return { ok: false, msg: '云端未配置' }
  const { data: sess } = await supabase.auth.getSession()
  if (!sess.session) return { ok: false, msg: '请先登录' }
  const userId = sess.session.user.id
  const rows = ledgers
    .filter(l => l.id !== 'default') // 默认账本无需上云
    .map(l => ({ user_id: userId, ledger_id: l.id, data: l, updated_at: new Date().toISOString(), deleted: false }))
  if (rows.length === 0) return { ok: true, msg: '无账本需同步' }
  const { error } = await supabase.from('ledgers').upsert(rows, { onConflict: 'user_id,ledger_id' })
  if (error) {
    if (/relation.*does not exist/i.test(error.message)) return { ok: false, msg: '云端 ledgers 表未创建，请重跑 schema.sql' }
    return { ok: false, msg: error.message }
  }
  return { ok: true, msg: `已同步 ${rows.length} 个账本` }
}

export async function syncLedgerDelete(ids: string[]): Promise<{ ok: boolean; msg: string }> {
  if (!SUPABASE_READY) return { ok: false, msg: '云端未配置' }
  const { data: sess } = await supabase.auth.getSession()
  if (!sess.session) return { ok: false, msg: '请先登录' }
  const { error } = await supabase.from('ledgers')
    .update({ deleted: true, updated_at: new Date().toISOString() })
    .eq('user_id', sess.session.user.id).in('ledger_id', ids)
  if (error) return { ok: false, msg: error.message }
  return { ok: true, msg: '已删除账本' }
}

let ledgerTimer: ReturnType<typeof setTimeout> | null = null
export async function autoSyncLedgers(ledgers: Ledger[]): Promise<void> {
  if (ledgerTimer) clearTimeout(ledgerTimer)
  ledgerTimer = setTimeout(() => { ledgerTimer = null; pushLedgers(ledgers) }, 3000)
}

// ---------- 打开/切回时统一拉取（记录 + 账本，含删除传播）----------
export interface PullAllResult {
  ok: boolean
  records: Expense[]
  deletedRecordIds: string[]
  ledgers: Ledger[]
  deletedLedgerIds: string[]
  msg: string
}

export async function pullAll(): Promise<PullAllResult> {
  const empty: PullAllResult = { ok: false, records: [], deletedRecordIds: [], ledgers: [], deletedLedgerIds: [], msg: '' }
  if (!SUPABASE_READY) return { ...empty, msg: '云端未配置' }
  const { data: sess } = await supabase.auth.getSession()
  if (!sess.session) return { ...empty, msg: '请先登录' }
  const uid = sess.session.user.id

  const [recRes, ledRes] = await Promise.all([
    supabase.from('records').select('record_id, data, deleted').eq('user_id', uid),
    supabase.from('ledgers').select('ledger_id, data, deleted').eq('user_id', uid),
  ])
  if (recRes.error) return { ...empty, msg: recRes.error.message }

  const records: Expense[] = [], deletedRecordIds: string[] = []
  for (const r of recRes.data ?? []) {
    if (r.deleted) deletedRecordIds.push(r.record_id)
    else records.push({ type: 'expense' as const, ...r.data } as Expense)
  }
  const ledgers: Ledger[] = [], deletedLedgerIds: string[] = []
  // ledgers 表可能尚未创建（用户没重跑 SQL），忽略其错误，不影响记录同步
  for (const l of (ledRes.error ? [] : ledRes.data ?? [])) {
    if (l.deleted) deletedLedgerIds.push(l.ledger_id)
    else ledgers.push(l.data as Ledger)
  }

  setLastSync()
  return { ok: true, records, deletedRecordIds, ledgers, deletedLedgerIds, msg: '已同步' }
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
