import { useState } from 'react'
import { useEntitlement, pricing, formatPrice, type Plan } from '../lib/entitlement'
import { PAY } from '../lib/payConfig'
import { XIcon, CheckIcon, CrownIcon, SparkIcon, ChevronLeft } from './icons'

const PRO_FEATURES = [
  '季度 / 半年 / 年度 深度可视化分析',
  '饮食健康长周期趋势与优化建议',
  'AI 智能增强解析（Claude）',
  '跨设备云同步',
  '数据导出 CSV',
  '无限历史记录',
]

export function Paywall({ onResult }: { onResult?: (msg: string) => void }) {
  const { paywallOpen, paywallReason, region, setRegion, status, startTrial, redeem, restore, closePaywall } = useEntitlement()
  const [selected, setSelected] = useState<Plan>('annual')
  const [step, setStep] = useState<'plans' | 'pay'>('plans')
  const [code, setCode] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  if (!paywallOpen) return null

  const { sym, plans } = pricing(region)
  const neverTrialed = status === 'free'
  const sel = plans.find((p) => p.id === selected)!
  const amount = formatPrice(region, sel.total)

  const close = () => { setStep('plans'); setMsg(null); setCode(''); closePaywall() }

  const doRedeem = async () => {
    if (!code.trim() || busy) return
    setBusy(true)
    setMsg(null)
    const r = await redeem(code)
    setBusy(false)
    if (r.ok) { onResult?.(r.msg); setCode('') } // 成功后 context 会关闭付费墙
    else setMsg(r.msg)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={close} />
      <div className="relative w-full sm:max-w-md card !rounded-t-3xl sm:!rounded-3xl rounded-b-none p-6 animate-pop safe-bottom max-h-[94vh] overflow-y-auto">
        <button onClick={close} className="absolute right-4 top-4 btn-ghost !p-2 !rounded-full"><XIcon size={18} /></button>

        {step === 'plans' ? (
          <>
            <div className="flex flex-col items-center text-center mb-5">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white mb-3" style={{ background: 'linear-gradient(135deg,#0a84ff,#30d158)' }}>
                <CrownIcon size={28} />
              </div>
              <h2 className="text-[22px] font-bold tracking-tight">花迹 Pro</h2>
              <p className="text-[13px] text-[#86868b] mt-1">{paywallReason ?? '解锁深度分析、AI 增强与云同步'}</p>
            </div>

            <div className="flex justify-center mb-4">
              <div className="seg text-[12px]">
                <button onClick={() => setRegion('cn')} className={`seg-item ${region === 'cn' ? 'seg-item-active' : ''}`}>🇨🇳 国内</button>
                <button onClick={() => setRegion('intl')} className={`seg-item ${region === 'intl' ? 'seg-item-active' : ''}`}>🌍 海外</button>
              </div>
            </div>

            <div className="space-y-2.5 mb-5">
              {plans.map((p) => {
                const active = p.id === selected
                return (
                  <button key={p.id} onClick={() => setSelected(p.id)} className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border-2 transition-all text-left ${active ? 'border-[#0a84ff] bg-[#0a84ff]/[0.06]' : 'border-[#00000010] dark:border-[#ffffff14]'}`}>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${active ? 'border-[#0a84ff] bg-[#0a84ff]' : 'border-[#c7c7cc]'}`}>
                      {active && <CheckIcon size={13} className="text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[15px]">{p.label}</span>
                        {p.badge && <span className="pill !py-0.5 !px-2 text-[10px] font-semibold text-white" style={{ background: 'linear-gradient(135deg,#ff9f0a,#ff375f)' }}>{p.badge}</span>}
                        {p.saveLabel && <span className="text-[11px] text-[#30d158] font-medium">{p.saveLabel}</span>}
                      </div>
                      <div className="text-[12px] text-[#86868b] mt-0.5">{formatPrice(region, p.perMonth)}/月</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-semibold text-[16px]">{formatPrice(region, p.total)}</div>
                      <div className="text-[11px] text-[#86868b]">{p.months === 1 ? '每月' : p.months === 3 ? '每季' : '每年'}</div>
                    </div>
                  </button>
                )
              })}
            </div>

            <div className="rounded-2xl bg-[#f5f5f7] dark:bg-[#2c2c2e]/60 p-3.5 mb-5 space-y-2">
              {PRO_FEATURES.map((f) => (
                <div key={f} className="flex items-center gap-2.5 text-[13px]"><CheckIcon size={15} className="text-[#30d158] shrink-0" /><span>{f}</span></div>
              ))}
            </div>

            {neverTrialed && (
              <button onClick={() => { startTrial(); close() }} className="btn-primary w-full !py-3 text-[16px] mb-2.5">
                <SparkIcon size={18} />开始 7 天免费试用
              </button>
            )}
            <button onClick={() => setStep('pay')} className={neverTrialed ? 'btn-ghost w-full justify-center' : 'btn-primary w-full !py-3 text-[16px]'}>
              {neverTrialed ? '已购买 / 用兑换码开通 →' : <>去支付 · {amount}</>}
            </button>
            <p className="text-[11px] text-[#86868b] text-center mt-2.5">{neverTrialed ? `免费试用 ${sym}0 · 可随时取消` : '可随时取消，到期前不再续费'}</p>
          </>
        ) : (
          /* —— 支付步骤 —— */
          <>
            <div className="flex items-center gap-2 mb-4">
              <button onClick={() => setStep('plans')} className="btn-ghost !p-2 !rounded-full"><ChevronLeft size={18} /></button>
              <h2 className="text-[17px] font-semibold">支付 · {sel.label} {amount}</h2>
            </div>

            {region === 'cn' ? (
              <div className="rounded-2xl bg-[#f5f5f7] dark:bg-[#2c2c2e]/60 p-4 mb-4">
                <div className="text-[13px] font-medium mb-3 text-center">扫码支付 <span className="text-[#ff3b30] font-semibold">{amount}</span></div>
                <div className="flex justify-center gap-6">
                  <PayQR src={PAY.cn.alipayQR} label="支付宝" name={PAY.cn.alipayName} />
                  <PayQR src={PAY.cn.wechatQR} label="微信" name={PAY.cn.wechatName} />
                </div>
              </div>
            ) : (
              <div className="rounded-2xl bg-[#f5f5f7] dark:bg-[#2c2c2e]/60 p-4 mb-4 text-center">
                <a href={PAY.intl.paypalMe} target="_blank" rel="noreferrer" className="btn-primary w-full !py-3" style={{ background: '#003087' }}>
                  用 PayPal 支付 {amount}
                </a>
                <div className="text-[11px] text-[#86868b] mt-2 break-all">{PAY.intl.paypalMe}</div>
              </div>
            )}

            <ContactMethods />

            {/* 兑换码 */}
            <label className="block text-[13px] font-medium mb-1.5">输入兑换码开通</label>
            <div className="flex gap-2">
              <input
                value={code}
                onChange={(e) => { setCode(e.target.value); setMsg(null) }}
                onKeyDown={(e) => { if (e.key === 'Enter') doRedeem() }}
                placeholder="HJ-Y-XXXXXX-XXXXXX"
                className="flex-1 rounded-xl bg-[#f5f5f7] dark:bg-[#2c2c2e] px-3 py-2.5 text-[15px] outline-none font-mono tracking-wide uppercase"
              />
              <button onClick={doRedeem} disabled={busy || !code.trim()} className="btn-primary !px-5">{busy ? '…' : '兑换'}</button>
            </div>
            {msg && <p className="text-[12px] text-[#ff3b30] mt-2">{msg}</p>}
            <button onClick={restore} className="w-full text-center text-[13px] text-[#0a84ff] mt-4">恢复购买</button>
          </>
        )}
      </div>
    </div>
  )
}

function PayQR({ src, label, name, sizeClass = 'w-32 h-32' }: { src: string; label: string; name?: string; sizeClass?: string }) {
  const [err, setErr] = useState(false)
  const [zoom, setZoom] = useState(false)
  return (
    <>
      <div className="flex flex-col items-center gap-1.5 cursor-pointer" onClick={() => !err && setZoom(true)}>
        {err ? (
          <div className={`${sizeClass} rounded-xl border-2 border-dashed border-[#c7c7cc] flex items-center justify-center text-[10px] text-[#86868b] text-center px-2 leading-snug`}>
            把图片放到<br />
            <span className="font-mono break-all">{src}</span>
          </div>
        ) : (
          <img src={src} onError={() => setErr(true)} alt={label} className={`${sizeClass} rounded-xl object-contain bg-white border border-[#00000010]`} />
        )}
        <span className="text-[12px] font-medium">{label}</span>
        {name && <span className="text-[10px] text-[#86868b] text-center leading-tight max-w-[8rem] truncate">{name}</span>}
      </div>
      {zoom && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setZoom(false)}>
          <img src={src} alt={label} className="max-w-[85vw] max-h-[85vh] rounded-2xl shadow-2xl object-contain bg-white" />
        </div>
      )}
    </>
  )
}

function ContactMethods() {
  const c = PAY.contact
  return (
    <div className="rounded-2xl bg-[#f5f5f7] dark:bg-[#2c2c2e]/60 p-4 mb-4">
      <div className="text-[12px] text-[#636366] dark:text-[#aeaeb2] leading-relaxed mb-3">{c.note}</div>
      <div className="flex items-start gap-3 flex-wrap">
        <PayQR src={c.wechatAddQR} label="扫码加微信" sizeClass="w-24 h-24" />
        {c.groupQR && <PayQR src={c.groupQR} label="进客服群" sizeClass="w-24 h-24" />}
        <div className="flex-1 min-w-[150px] space-y-2 pt-0.5">
          {c.wechatId && <CopyRow label="微信号" value={c.wechatId} />}
          {c.email && <CopyRow label="邮箱" value={c.email} />}
        </div>
      </div>
    </div>
  )
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [done, setDone] = useState(false)
  const copy = () => {
    navigator.clipboard?.writeText(value).then(() => { setDone(true); setTimeout(() => setDone(false), 1200) }).catch(() => {})
  }
  return (
    <button onClick={copy} className="w-full flex items-center justify-between gap-2 rounded-xl bg-white dark:bg-[#1c1c1e] border border-[#00000010] dark:border-[#ffffff12] px-3 py-2 text-left">
      <div className="min-w-0">
        <div className="text-[11px] text-[#86868b]">{label}</div>
        <div className="text-[14px] font-medium truncate">{value}</div>
      </div>
      <span className="text-[12px] text-[#0a84ff] shrink-0 font-medium">{done ? '已复制' : '复制'}</span>
    </button>
  )
}
