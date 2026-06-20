import { useState } from 'react'
import { useEntitlement } from '../lib/entitlement'
import { XIcon, CrownIcon } from './icons'

export function LoginSheet() {
  const { loginOpen, closeLogin, sendOtp, verifyOtp, signInWithPassword, resetPassword } = useEntitlement()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [pw, setPw] = useState('')
  const [step, setStep] = useState<'email' | 'code' | 'password' | 'forgot'>('email')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  if (!loginOpen) return null

  const close = () => {
    closeLogin()
    setTimeout(() => { setStep('email'); setCode(''); setPw(''); setMsg(null); setOk(false) }, 200)
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

  const loginPw = async () => {
    if (!pw || busy) return
    setBusy(true); setMsg(null)
    const r = await signInWithPassword(email, pw)
    setBusy(false)
    if (r.ok) close()
    else { setOk(false); setMsg(r.msg) }
  }

  const forgot = async () => {
    if (!email.trim() || busy) return
    setBusy(true); setMsg(null)
    const r = await resetPassword(email)
    setBusy(false)
    setOk(r.ok); setMsg(r.msg)
    if (r.ok) setStep('forgot')
  }

  const sub = step === 'email' ? '用邮箱登录，开通后可跨设备恢复 Pro'
    : step === 'code' ? `验证码已发送至 ${email}`
    : step === 'password' ? `使用密码登录 ${email}`
    : `重置链接已发送至 ${email}`

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
          <p className="text-[13px] text-[#86868b] mt-1">{sub}</p>
        </div>

        {step === 'email' && (
          <>
            <input
              type="email" inputMode="email" autoFocus value={email}
              onChange={(e) => { setEmail(e.target.value); setMsg(null) }}
              onKeyDown={(e) => { if (e.key === 'Enter') send() }}
              placeholder="you@example.com"
              className="w-full rounded-xl bg-[#f5f5f7] dark:bg-[#2c2c2e] px-3.5 py-3 text-[15px] outline-none mb-3"
            />
            <button onClick={send} disabled={busy || !email.trim()} className="btn-primary w-full !py-3 text-[16px]">
              {busy ? '发送中…' : '发送验证码'}
            </button>
            <button onClick={() => { if (email.trim()) { setStep('password'); setMsg(null) } else setMsg('请先输入邮箱') }}
              className="w-full text-center text-[13px] text-[#0a84ff] mt-3">
              密码登录
            </button>
          </>
        )}

        {step === 'code' && (
          <>
            <input
              inputMode="numeric" autoFocus value={code}
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

        {step === 'password' && (
          <>
            <input
              type="password" autoFocus value={pw}
              onChange={(e) => { setPw(e.target.value); setMsg(null) }}
              onKeyDown={(e) => { if (e.key === 'Enter') loginPw() }}
              placeholder="输入密码"
              className="w-full rounded-xl bg-[#f5f5f7] dark:bg-[#2c2c2e] px-3.5 py-3 text-[15px] outline-none mb-3"
            />
            <button onClick={loginPw} disabled={busy || !pw} className="btn-primary w-full !py-3 text-[16px]">
              {busy ? '登录中…' : '登录'}
            </button>
            <div className="flex justify-between mt-3">
              <button onClick={() => { setStep('email'); setMsg(null); setPw('') }} className="text-[13px] text-[#86868b]">
                验证码登录
              </button>
              <button onClick={forgot} className="text-[13px] text-[#0a84ff]">
                忘记密码？
              </button>
            </div>
          </>
        )}

        {step === 'forgot' && (
          <>
            <div className="text-center text-[14px] text-[#86868b] mb-4">
              请查看邮箱，点击重置链接后设置新密码。
            </div>
            <button onClick={() => { setStep('email'); setMsg(null) }} className="btn-primary w-full !py-3 text-[16px]">
              返回登录
            </button>
          </>
        )}

        {msg && <p className={`text-[12px] mt-3 text-center ${ok ? 'text-[#30d158]' : 'text-[#ff3b30]'}`}>{msg}</p>}
      </div>
    </div>
  )
}
