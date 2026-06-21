import { describe, it, expect } from 'vitest'
import { parseMultiExpense } from './parser'

// 固定"现在"= 2026-06-21 12:30（中午），保证餐次/相对时间确定性
const NOW = new Date('2026-06-21T12:30:00')
const P = (t: string) => parseMultiExpense(t, NOW)
const one = (t: string) => P(t)[0]

// ============================================================================
// 金额 / 数字（解析器最容易出错、影响最大）
// ============================================================================
describe('金额与中文数字', () => {
  it('阿拉伯数字 + 单位', () => {
    expect(one('中午吃了麻辣烫28').amount).toBe(28)
    expect(one('打车回家35').amount).toBe(35)
    expect(one('两块五毛').amount).toBe(2.5)
    expect(one('0.5元的辣条').amount).toBe(0.5)
  })
  it('w / 万 / k / 千 单位展开', () => {
    expect(one('兼职赚了3w').amount).toBe(30000)
    expect(one('发工资1.2万').amount).toBe(12000)
    expect(one('工资3.5万').amount).toBe(35000)
    expect(one('收到5k').amount).toBe(5000)
    expect(one('一个月房租3千').amount).toBe(3000)
  })
  it('中文口语数字（末位省略单位）', () => {
    expect(one('一百二十块吃的火锅').amount).toBe(120)
    expect(one('花了三百八').amount).toBe(380)
    expect(one('两千五的手机').amount).toBe(2500)
    expect(one('一万二千五发工资').amount).toBe(12500)
    expect(one('挣了2万5').amount).toBe(25000)
    expect(one('一百五打车').amount).toBe(150)
  })
  it('时间数字 / 量词不被误当金额', () => {
    expect(one('昨天晚上9点多吃了一碗螺蛳粉，10块').amount).toBe(10)
    expect(one('今天中午12点，一份大头鱼加一份青椒炒鸡块，24块').amount).toBe(24)
    expect(one('买了一瓶5升矿泉水10块').amount).toBe(10)
  })
})

// ============================================================================
// 餐饮：吃（有餐次 + 健康分 + 菜名提取）
// ============================================================================
describe('餐饮-吃', () => {
  it('单品菜名干净提取', () => {
    expect(one('中午吃了麻辣烫28').items).toEqual(['麻辣烫'])
    expect(one('昨天晚上9点多吃了一碗螺蛳粉，10块').items).toEqual(['螺蛳粉'])
    expect(one('要了份宫保鸡丁28').items).toEqual(['宫保鸡丁'])
  })
  it('多菜并列：顿号 / 加 / 还点了', () => {
    expect(one('晚饭点了红烧肉、青菜、米饭，35').items).toEqual(['红烧肉', '青菜', '米饭'])
    expect(one('今天中午12点，一份大头鱼加一份青椒炒鸡块，24块').items).toEqual(['大头鱼', '青椒炒鸡块'])
    expect(one('吃了顿火锅还点了瓶饮料，120').items).toEqual(['火锅', '饮料'])
  })
  it('商家名不当菜名', () => {
    expect(one('下午茶喝了杯星巴克拿铁35').items).toEqual(['拿铁'])
  })
  it('场景词（外卖/食堂）不当菜名', () => {
    expect(one('外卖黄焖鸡米饭25').items).toEqual(['黄焖鸡米饭'])
  })
  it('吃的有餐次和健康分', () => {
    const r = one('中午吃了麻辣烫28')
    expect(r.category).toBe('food')
    expect(r.meal).toBeTruthy()
    expect(r.health).toBeTruthy()
  })
})

// ============================================================================
// 餐饮：买（采购，不算一餐，无餐次/健康分）
// ============================================================================
describe('采购≠一餐', () => {
  it('买的水/饮料不打餐次和健康分', () => {
    const r = one('买了一瓶5升矿泉水10块')
    expect(r.items).toEqual(['矿泉水'])
    expect(r.meal).toBeUndefined()
    expect(r.health).toBeUndefined()
  })
  it('喝的仍算一餐', () => {
    const r = one('中午喝了瓶可乐3块')
    expect(r.meal).toBeTruthy()
    expect(r.health).toBeTruthy()
  })
})

// ============================================================================
// 分类
// ============================================================================
describe('分类', () => {
  const cat = (t: string) => one(t).category
  it('交通（含汽车场景）', () => {
    expect(cat('加油300')).toBe('transport')
    expect(cat('汽车保养花了800')).toBe('transport')
    expect(cat('违章罚款200')).toBe('transport')
    expect(cat('停车费15')).toBe('transport')
    expect(cat('高铁票553')).toBe('transport')
  })
  it('购物（含宠物/个护/烟）', () => {
    expect(cat('淘宝买了件外套299')).toBe('shopping')
    expect(cat('给猫买猫粮120')).toBe('shopping')
    expect(cat('理发60')).toBe('shopping')
    expect(cat('抽了包烟20')).toBe('shopping')
    expect(cat('给女朋友买了束花99')).toBe('shopping')
  })
  it('居住 / 医疗 / 教育 / 通讯', () => {
    expect(cat('交房租3000')).toBe('housing')
    expect(cat('看牙花了500')).toBe('medical')
    expect(cat('报了个网课999')).toBe('education')
    expect(cat('话费充了100')).toBe('communication')
  })
  it('人情社交', () => {
    expect(cat('给孩子压岁钱200')).toBe('social')
    expect(cat('请客吃饭花了500')).toBe('social')
    expect(cat('同事结婚随礼500')).toBe('social')
  })
})

// ============================================================================
// 收入
// ============================================================================
describe('收入', () => {
  const inc = (t: string) => one(t)
  it('工资/奖金/退款/理财/兼职', () => {
    expect(inc('发工资8000').type).toBe('income')
    expect(inc('年终奖5万到账').type).toBe('income')
    expect(inc('收到退款50').type).toBe('income')
    expect(inc('理财收益500').type).toBe('income')
    expect(inc('卖了旧手机800').type).toBe('income')
    expect(inc('退了我30').type).toBe('income')
  })
  it('彩票：中=收入，买=支出', () => {
    expect(inc('中了500彩票').type).toBe('income')
    expect(inc('彩票中了2000').type).toBe('income')
    expect(inc('买彩票花了20').type).toBe('expense')
  })
  it('收入不混入菜名 items', () => {
    expect(inc('工资到账还有奖金，一共15000').items).toEqual([])
    expect(inc('工资到账还有奖金，一共15000').amount).toBe(15000)
  })
})

// ============================================================================
// 借贷
// ============================================================================
describe('借贷', () => {
  it('借出 = 支出方向 + 标记 isDebt', () => {
    const r = one('借给小王1000')
    expect(r.amount).toBe(1000)
    expect(r.isDebt).toBe(true)
    expect(r.type).toBe('expense')
  })
  it('还我 = 收入', () => {
    expect(one('朋友还我200').type).toBe('income')
  })
})

// ============================================================================
// 多笔拆分
// ============================================================================
describe('多笔拆分', () => {
  it('时间/活动词触发新一笔', () => {
    const r = P('中午吃麻辣烫28，打车回家35，下午奶茶18')
    expect(r.length).toBe(3)
    expect(r.map(x => x.amount)).toEqual([28, 35, 18])
  })
  it('交/缴/买 触发新一笔', () => {
    const r = P('买菜120，交电费88')
    expect(r.length).toBe(2)
    expect(r[1].category).toBe('housing')
  })
  it('纯金额尾句合并回上一段（不另算一笔）', () => {
    expect(P('今天中午在湖南小碗菜吃红烧肉、青菜，总共花了十九块钱').length).toBe(1)
  })
})

// ============================================================================
// 边界 / 口语 / 鲁棒性
// ============================================================================
describe('边界鲁棒性', () => {
  it('emoji 忽略', () => {
    expect(one('奶茶🧋18').amount).toBe(18)
    expect(one('打车🚗35').category).toBe('transport')
  })
  it('无金额不崩，金额为 null', () => {
    expect(one('奶茶').amount).toBeNull()
  })
  it('无意义输入不崩', () => {
    expect(() => P('哈哈哈哈')).not.toThrow()
    expect(() => P('')).not.toThrow()
  })
  it('纯数字兜底', () => {
    expect(one('35').amount).toBe(35)
  })
  it('菜名不残留时间字/量词', () => {
    // 回归：曾出现"点多吃了螺蛳粉""点、大头鱼"
    for (const it of one('昨天晚上9点多吃了一碗螺蛳粉，10块').items) {
      expect(it).not.toMatch(/[点:：\d]/)
    }
  })
})
