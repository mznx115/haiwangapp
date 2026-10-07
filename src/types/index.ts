/** 关系阶段 */
export type RelationStage = 'stranger' | 'friend' | 'flirty' | 'stable'

/** 聊天对象档案 */
export interface Profile {
  id: string
  /** 昵称/代号 */
  name: string
  /** 认识渠道：社交软件 / 线下 / 朋友介绍 … */
  source: string
  /** 关系阶段 */
  stage: RelationStage
  /** 主题色，用于防串号的视觉锚点 */
  themeColor: string
  /** 喜好 */
  likes: string
  /** 禁忌 */
  dislikes: string
  /** 关键信息与进度记录 */
  notes: string
  /** 常聊时段，用于多线时间分区 */
  chatWindow: string
  archived: boolean
  createdAt: number
  updatedAt: number
}

/** 单条话术卡片 */
export interface ReplyCard {
  /** 风格标签，如「稳妥版」 */
  style: string
  /** 可直接复制的话术正文 */
  text: string
  /** 适用场景 */
  scenario: string
  /** 风险提示 */
  risk: string
  /** UI 复制反馈 */
  copied?: boolean
}

/** 模型返回的结构化结果 */
export interface SkillAnswer {
  /** 对方态度与关系阶段判断 */
  analysis: string
  replies: ReplyCard[]
  /** 后续节奏建议 */
  nextStep: string
  warnings: string[]
}

export type MessageRole = 'user' | 'assistant'

/** 一条会话消息 */
export interface Message {
  id: string
  /** 强绑定归属对象 —— 防串号的数据层保证 */
  profileId: string
  role: MessageRole
  content: string
  /** assistant 消息的结构化结果 */
  answer?: SkillAnswer
  /** 结构化解析失败、降级为纯文本渲染 */
  rawFallback?: boolean
  /** 请求出错信息 */
  error?: string
  /** 输出后置安全校验结果（仅结构化解析失败时挂在消息上） */
  safety?: string[]
  createdAt: number
}

/** 我的人设卡 */
export interface Persona {
  nickname: string
  age: string
  traits: string
  speechStyle: string
  boundaries: string
}

/** 应用设置 */
export interface AppSettings {
  baseUrl: string
  apiKey: string
  model: string
  temperature: number
  maxTokens: number
  stream: boolean
  /** 模型上下文窗口，用于 token 预算 */
  contextWindow: number
  /** 超过多少轮开始滚动摘要 */
  summarizeAfter: number
}

/** 生成话术时的附加指令 */
export interface GenerateOptions {
  /** 对方最新消息，或我自己的草稿 */
  input: string
  /** 用户追加的场景/语气要求 */
  extra?: string
}
