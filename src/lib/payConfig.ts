// ============================================================================
// 收款配置
//
// 国内收款码图片：把你的两张收款码存到 public/pay/ 下（文件名要和下面一致）：
//   public/pay/alipay.png   ← 支付宝收款码
//   public/pay/wechat.png   ← 微信收款码
// （图片二进制我没法从聊天里直接写盘，这两张请你拖进去；其余都已接好。）
//
// ⛳️ 自动开通（免人工发码）需要商户号(支付宝/微信，要营业执照/个体户)或
//    PayPal Orders/Subscriptions API + 后端 Webhook。见对话里的分阶段说明。
// ============================================================================

const BASE = import.meta.env.BASE_URL

export const PAY = {
  cn: {
    enabled: true,
    alipayQR: `${BASE}pay/alipay.png`,
    alipayName: '三千，二号（*东）',
    wechatQR: `${BASE}pay/wechat.png`,
    wechatName: '明道 Garry｜AI增长（*东）',
  },
  intl: {
    enabled: true,
    paypalMe: 'https://www.paypal.me/Garryken',
  },
  contact: {
    note: '付款后，把支付截图用以下任一方式发我，5 分钟内回你兑换码：',
    wechatAddQR: `${BASE}pay/wechat-contact.png`,
    wechatId: 'kt76189',
    email: 'HZGarry@outlook.com',
    groupQR: '',
  },
}
