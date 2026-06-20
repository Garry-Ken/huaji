export interface LedgerTemplate {
  id: string
  name: string
  emoji: string
  description: string
  color: string
  subtitle: string
}

export const LEDGER_TEMPLATES: LedgerTemplate[] = [
  { id: 'gift', emoji: '🎁', name: '礼金簿', subtitle: '记录人情往来', description: '记录人情往来，谁送了什么', color: 'linear-gradient(135deg,#ff375f,#ff9f0a)' },
  { id: 'investment', emoji: '📈', name: '投资账本', subtitle: '投资理财记录', description: '投资收支、理财记录', color: 'linear-gradient(135deg,#30d158,#0a84ff)' },
  { id: 'project', emoji: '💼', name: '项目账本', subtitle: '项目收支管理', description: '项目收支管理', color: 'linear-gradient(135deg,#5e5ce6,#bf5af2)' },
  { id: 'travel', emoji: '✈️', name: '旅行账本', subtitle: '旅途花销记录', description: '旅途花销记录', color: 'linear-gradient(135deg,#0a84ff,#64d2ff)' },
  { id: 'family', emoji: '🏠', name: '家庭账本', subtitle: '家庭日常开支', description: '家庭日常开支', color: 'linear-gradient(135deg,#ff9f0a,#ffd60a)' },
  { id: 'blank', emoji: '➕', name: '', subtitle: '自定义账本', description: '', color: '' },
]
