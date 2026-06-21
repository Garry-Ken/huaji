// ============================================================================
// 大模型服务商预设（兼容 OpenAI /chat/completions 格式）
// 参考 cc-switch 的做法：内置主流厂商，店主选厂商→填 Key→选模型即可，无需手敲 URL。
// 模型列表为常用起步项，可随时改成自定义。
// ============================================================================

export interface AiProvider {
  id: string
  name: string
  baseURL: string
  models: string[]
  keyHint?: string // Key 格式提示
  site?: string // 获取 Key 的网址
}

export const AI_PROVIDERS: AiProvider[] = [
  {
    id: 'mimo',
    name: '小米 MiMo',
    baseURL: 'https://api.xiaomimimo.com/v1/chat/completions',
    models: ['mimo-v2-flash', 'mimo-v2'],
    keyHint: 'sk-...',
    site: 'https://xiaomimimo.com',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    baseURL: 'https://api.deepseek.com/v1/chat/completions',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    keyHint: 'sk-...',
    site: 'https://platform.deepseek.com',
  },
  {
    id: 'siliconflow',
    name: '硅基流动',
    baseURL: 'https://api.siliconflow.cn/v1/chat/completions',
    models: ['deepseek-ai/DeepSeek-V3', 'deepseek-ai/DeepSeek-R1', 'Qwen/Qwen2.5-7B-Instruct', 'Qwen/Qwen2.5-72B-Instruct'],
    keyHint: 'sk-...',
    site: 'https://cloud.siliconflow.cn',
  },
  {
    id: 'moonshot',
    name: 'Kimi 月之暗面',
    baseURL: 'https://api.moonshot.cn/v1/chat/completions',
    models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k', 'kimi-latest'],
    keyHint: 'sk-...',
    site: 'https://platform.moonshot.cn',
  },
  {
    id: 'zhipu',
    name: '智谱 GLM',
    baseURL: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    models: ['glm-4-flash', 'glm-4-plus', 'glm-4.6'],
    keyHint: 'xxxxxxxx.xxxxxxxx',
    site: 'https://bigmodel.cn',
  },
  {
    id: 'qwen',
    name: '阿里通义千问',
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    models: ['qwen-turbo', 'qwen-plus', 'qwen-max'],
    keyHint: 'sk-...',
    site: 'https://bailian.console.aliyun.com',
  },
  {
    id: 'volcano',
    name: '火山方舟 豆包',
    baseURL: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
    models: ['doubao-pro-32k', 'doubao-lite-32k', 'doubao-seed-1-6'],
    keyHint: '火山方舟 API Key',
    site: 'https://console.volcengine.com/ark',
  },
  {
    id: 'qianfan',
    name: '百度千帆',
    baseURL: 'https://qianfan.baidubce.com/v2/chat/completions',
    models: ['ernie-4.0-8k', 'ernie-3.5-8k', 'ernie-speed-8k'],
    keyHint: 'bce-v3/...',
    site: 'https://console.bce.baidu.com/qianfan',
  },
  {
    id: 'hunyuan',
    name: '腾讯混元',
    baseURL: 'https://api.hunyuan.cloud.tencent.com/v1/chat/completions',
    models: ['hunyuan-turbo', 'hunyuan-standard', 'hunyuan-lite'],
    keyHint: 'sk-...',
    site: 'https://console.cloud.tencent.com/hunyuan',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    baseURL: 'https://api.openai.com/v1/chat/completions',
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1'],
    keyHint: 'sk-...',
    site: 'https://platform.openai.com',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    baseURL: 'https://openrouter.ai/api/v1/chat/completions',
    models: ['deepseek/deepseek-chat', 'openai/gpt-4o-mini', 'google/gemini-2.0-flash-exp'],
    keyHint: 'sk-or-v1-...',
    site: 'https://openrouter.ai/keys',
  },
  {
    id: 'groq',
    name: 'Groq',
    baseURL: 'https://api.groq.com/openai/v1/chat/completions',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'],
    keyHint: 'gsk_...',
    site: 'https://console.groq.com/keys',
  },
  {
    id: 'custom',
    name: '自定义',
    baseURL: '',
    models: [],
    keyHint: 'sk-...',
  },
]

/** 根据接口地址反查所属服务商（用于回显当前选中项）。匹配不到则归为 custom。 */
export function matchProvider(baseURL: string): string {
  if (!baseURL) return 'custom'
  const hit = AI_PROVIDERS.find((p) => p.id !== 'custom' && p.baseURL === baseURL)
  if (hit) return hit.id
  // 宽松匹配：同域名也算（用户可能改了路径）
  try {
    const host = new URL(baseURL).host
    const byHost = AI_PROVIDERS.find((p) => p.id !== 'custom' && new URL(p.baseURL).host === host)
    if (byHost) return byHost.id
  } catch { /* ignore */ }
  return 'custom'
}
