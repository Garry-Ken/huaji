import type { CategoryId } from '../types'

export interface CategoryMeta {
  id: CategoryId
  label: string
  emoji: string
  color: string // 主色（用于图表/标签）
  /** 命中即归入该类的关键词 */
  keywords: string[]
}

// Apple 系统色板，保证图表与标签视觉统一
export const CATEGORIES: Record<CategoryId, CategoryMeta> = {
  food: {
    id: 'food',
    label: '餐饮',
    emoji: '🍜',
    color: '#ff9f0a',
    keywords: [
      '吃', '喝', '餐', '饭', '早餐', '午餐', '晚餐', '夜宵', '宵夜', '外卖', '食堂',
      '咖啡', '奶茶', '饮料', '可乐', '星巴克', '瑞幸', '蜜雪', '喜茶', '茶',
      '麦当劳', '肯德基', '汉堡', '披萨', '火锅', '烧烤', '串', '麻辣烫', '炸鸡',
      '面', '米饭', '盖饭', '快餐', '小吃', '零食', '水果', '蔬菜', '超市买菜', '买菜',
      '餐厅', '饭店', '酒楼', '食', '甜品', '蛋糕', '面包', '寿司', '日料', '韩餐',
    ],
  },
  transport: {
    id: 'transport',
    label: '交通',
    emoji: '🚗',
    color: '#0a84ff',
    keywords: [
      '打车', '滴滴', '出租', '出租车', 'taxi', '高铁', '动车', '火车', '机票', '飞机',
      '地铁', '公交', '公交车', '车票', '加油', '加油站', '油费', '停车', '停车费', '过路费', '高速', 'etc',
      '共享单车', '单车', '摩拜', '哈啰', '充电', '保养', '洗车', '违章', '违停', '超速',
      '罚单', '罚款', '扣分', '修车', '汽修', '补胎', '换胎', '车险', '年检', '4s店', '驾照', '驾考', '车位',
    ],
  },
  shopping: {
    id: 'shopping',
    label: '购物',
    emoji: '🛍️',
    color: '#ff375f',
    keywords: [
      '买', '购', '淘宝', '京东', '拼多多', '天猫', '衣服', '鞋', '裤子', '裙子', '外套',
      '化妆品', '护肤', '口红', '数码', '手机', '电脑', '耳机', '家电', '日用品', '洗发水',
      '纸巾', '快递', '包', '配饰', '电器', '家居', '家具',
      '宠物', '猫粮', '狗粮', '猫砂', '理发', '美发', '美容', '美甲', '香烟', '烟',
    ],
  },
  entertainment: {
    id: 'entertainment',
    label: '娱乐',
    emoji: '🎮',
    color: '#bf5af2',
    keywords: [
      '电影', '电影票', 'ktv', '唱歌', '游戏', '充值', '会员', '视频', '腾讯视频', '爱奇艺',
      '优酷', '网易云', 'spotify', '演唱会', '门票', '展览', '密室', '剧本杀', '桌游', '酒吧',
      '旅游', '景点', '游乐园', '健身房', '健身',
    ],
  },
  housing: {
    id: 'housing',
    label: '居住',
    emoji: '🏠',
    color: '#5e5ce6',
    keywords: [
      '房租', '租金', '水费', '电费', '燃气', '煤气', '物业', '物业费', '取暖', '宽带', '网费',
      '酒店', '住宿', '民宿', '房贷',
    ],
  },
  medical: {
    id: 'medical',
    label: '医疗',
    emoji: '💊',
    color: '#ff453a',
    keywords: [
      '医院', '看病', '挂号', '药', '药店', '买药', '体检', '牙', '口腔', '诊所', '门诊',
      '住院', '疫苗', '检查', '理疗', '保健',
    ],
  },
  education: {
    id: 'education',
    label: '教育',
    emoji: '📚',
    color: '#64d2ff',
    keywords: [
      '书', '买书', '课程', '网课', '培训', '学费', '报班', '考试', '资料', '文具', '辅导',
      '知识星球', '订阅专栏', '学习',
    ],
  },
  communication: {
    id: 'communication',
    label: '通讯',
    emoji: '📱',
    color: '#30d158',
    keywords: ['话费', '流量', '电话费', '充话费', '宽带费', '套餐', 'sim', '手机卡'],
  },
  social: {
    id: 'social',
    label: '人情社交',
    emoji: '🎁',
    color: '#ffd60a',
    keywords: [
      '红包', '随礼', '随份子', '份子', '礼物', '请客', '送礼', '聚会', '聚餐aa', '婚礼', '满月', '生日',
      '孝敬', '给爸妈', '转账', '请同事', '请朋友', '请人', '请同学', '请老师',
      '压岁钱', '彩礼', '慰问', '看望', '探望', '随分子',
    ],
  },
  income: {
    id: 'income',
    label: '收入',
    emoji: '💰',
    color: '#30d158',
    keywords: [
      '工资', '薪水', '薪资', '奖金', '年终奖', '分红', '稿费', '退款', '报销',
      '利息', '理财收益', '投资收益', '分成', '提成', '佣金', '补贴', '补助', '津贴',
      '收入', '到账', '进账', '发工资',
    ],
  },
  other: {
    id: 'other',
    label: '其他',
    emoji: '📦',
    color: '#98989d',
    keywords: [],
  },
}

export const CATEGORY_LIST: CategoryMeta[] = Object.values(CATEGORIES)

export function categoryMeta(id: CategoryId): CategoryMeta {
  return CATEGORIES[id] ?? CATEGORIES.other
}
