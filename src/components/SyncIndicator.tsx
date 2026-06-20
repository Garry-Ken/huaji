import { CloudIcon, CheckIcon } from './icons'

export type SyncStatus = 'idle' | 'syncing' | 'done' | 'error'

export function SyncIndicator({ status, onClick }: { status: SyncStatus; onClick?: () => void }) {
  if (status === 'idle') return null

  return (
    <button onClick={onClick} className="relative w-7 h-7 flex items-center justify-center" title={
      status === 'syncing' ? '同步中…' : status === 'done' ? '已同步' : '同步失败'
    }>
      {status === 'syncing' && (
        <span className="animate-spin text-[#0a84ff]"><CloudIcon size={16} /></span>
      )}
      {status === 'done' && (
        <span className="text-[#30d158]"><CheckIcon size={16} /></span>
      )}
      {status === 'error' && (
        <span className="text-[#ff3b30] text-[14px] font-bold">!</span>
      )}
    </button>
  )
}
