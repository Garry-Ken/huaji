import { useState } from 'react'
import { useEntitlement } from '../lib/entitlement'
import { XIcon, ShieldIcon } from './icons'

export function PasswordResetSheet() {
  const { passwordRecovery, dismissPasswordRecovery, updatePassword } = useEntitlement()
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  if (!passwordRecovery) return null

  const mismatch = pw2.length > 0 && pw !== pw2
  const valid = pw.length >= 6 && pw === pw2

  const submit = async () => {
    if (!valid || busy) return
    setBusy(true); setMsg(null)
    const r = await updatePassword(pw)
    setBusy(false)
    if (r.ok) { setMsg('密码已设置成功 ✓'); setTimeout(dismissPasswordRecovery, 1200) }
    else setMsg(r.msg)
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative w-full sm:max-w-sm card !rounded-t-3xl sm:!rounded-3xl rounded-b-none p-6 animate-pop safe-bottom">
        <button onClick={dismissPasswordRecovery} className="absolute right-4 top-4 btn-ghost !p-2 !rounded-full"><XIcon size={18} /></button>

        <div className="flex flex-col items-center text-center mb-5">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white mb-3" style={{ background: 'linear-gradient(135deg,#ff9f0a,#ff375f)' }}>
            <ShieldIcon size={28} />
          </div>
          <h2 className="text-[20px] font-bold tracking-tight">设置新密码</h2>
          <p className="text-[13px] text-[#86868b] mt-1">请设置你的新密码（至少 6 位）</p>
        </div>

        <input
          type="password" autoFocus value={pw}
          onChange={(e) => { setPw(e.target.value); setMsg(null) }}
          placeholder="新密码"
          className="w-full rounded-xl bg-[#f5f5f7] dark:bg-[#2c2c2e] px-3.5 py-3 text-[15px] outline-none mb-3"
        />
        <input
          type="password" value={pw2}
          onChange={(e) => { setPw2(e.target.value); setMsg(null) }}
          onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
          placeholder="确认密码"
          className="w-full rounded-xl bg-[#f5f5f7] dark:bg-[#2c2c2e] px-3.5 py-3 text-[15px] outline-none mb-3"
        />
        {mismatch && <p className="text-[12px] text-[#ff3b30] mb-2">两次密码不一致</p>}

        <button onClick={submit} disabled={!valid || busy} className="btn-primary w-full !py-3 text-[16px]">
          {busy ? '设置中…' : '确认设置'}
        </button>

        {msg && <p className={`text-[12px] mt-3 text-center ${msg.includes('✓') ? 'text-[#30d158]' : 'text-[#ff3b30]'}`}>{msg}</p>}
      </div>
    </div>
  )
}
