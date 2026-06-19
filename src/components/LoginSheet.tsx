import { useState } from 'react'
import { useEntitlement } from '../lib/entitlement'
import { XIcon, CrownIcon } from './icons'

// 邮箱验证码登录：输入邮箱 → 收 6 位码 → 验证。跨平台（网页/Mac/Win/安卓）通用。
export function LoginSheet() {
  const { loginOpen, closeLogin, sendOtp, verifyOtp } = useEntitlement()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  if (!loginOpen) return null

  const close = () => {
    closeLogin()
    setTimeout(() => {
      setStep('email'); setCode(''); setMsg(null); setOk(false)
    }, 200)
  }

  const send = async () => {
    if (!email.trim() || busy) return
    setBusy(true); setMsg(null)
    const r = await sendOtp(email)
    setBusy(false)
    setOk(r.ok); setMsg(r.msg)
    if (r.ok) setStep('code')
  }

  const verify = async () => {
    if (code.trim().length < 4 || busy) return
    setBusy(true); setMsg(null)
    const r = await verifyOtp(email, code)
    setBusy(false)
    if (r.ok) close()
    else { setOk(false); setMsg(r.msg) }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={close} />
      <div className="relative w-full sm:max-w-sm card !rounded-t-3xl sm:!rounded-3xl rounded-b-none p-6 animate-pop safe-bottom">
        <button onClick={close} className="absolute right-4 top-4 btn-ghost !p-2 !rounded-full"><XIcon size={18} /></button>

        <div className="flex flex-col items-center text-center mb-5">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white mb-3" style={{ background: 'linear-gradient(135deg,#0a84ff,#30d158)' }}>
            <CrownIcon size={28} />
          </div>
          <h2 className="text-[20px] font-bold tracking-tight">登录花迹</h2>
          <p className="text-[13px] text-[#86868b] mt-1">
            {step === 'email' ? '用邮箱登录，开通后可跨设备恢复 Pro' : `验证码已发送至 ${email}`}
          </p>
        </div>

        {step === 'email' ? (
          <>
            <input
              type="email"
              inputMode="email"
              autoFocus
              value={email}
              onChange={(e) => { setEmail(e.target.value); setMsg(null) }}
              onKeyDown={(e) => { if (e.key === 'Enter') send() }}
              placeholder="you@example.com"
              className="w-full rounded-xl bg-[#f5f5f7] dark:bg-[#2c2c2e] px-3.5 py-3 text-[15px] outline-none mb-3"
            />
            <button onClick={send} disabled={busy || !email.trim()} className="btn-primary w-full !py-3 text-[16px]">
              {busy ? '发送中…' : '发送验证码'}
            </button>
          </>
        ) : (
          <>
            <input
              inputMode="numeric"
              autoFocus
              value={code}
              onChange={(e) => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setMsg(null) }}
              onKeyDown={(e) => { if (e.key === 'Enter') verify() }}
              placeholder="6 位验证码"
              className="w-full rounded-xl bg-[#f5f5f7] dark:bg-[#2c2c2e] px-3.5 py-3 text-[20px] tracking-[0.4em] text-center outline-none mb-3 font-mono"
            />
            <button onClick={verify} disabled={busy || code.trim().length < 4} className="btn-primary w-full !py-3 text-[16px]">
              {busy ? '验证中…' : '登录'}
            </button>
            <button onClick={() => { setStep('email'); setMsg(null); setCode('') }} className="w-full text-center text-[13px] text-[#86868b] mt-3">
              换个邮箱 / 重新发送
            </button>
          </>
        )}

        {msg && <p className={`text-[12px] mt-3 text-center ${ok ? 'text-[#30d158]' : 'text-[#ff3b30]'}`}>{msg}</p>}
      </div>
    </div>
  )
}
