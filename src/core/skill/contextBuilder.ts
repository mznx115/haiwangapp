import type { AppSettings, Message, Persona, Profile } from '@/types'
import type { ChatMessage } from '@/core/api/types'
import { haiwangSkill } from '@/skills'
import { STAGE_META } from '@/core/stage'
import { estimateTokens } from './token'
import { MEMORY_RECENT_HEADER, MEMORY_SUMMARY_HEADER, OUTPUT_CONTRACT } from './contract'

/**
 * 六层提示词组装器。
 *
 * 这是「调用 AI 时使用这个 skill」的落地实现。
 *
 * 关键安全约束：本函数**只接受一个 profile 对象**，
 * 物理上拿不到其它对象的档案与历史 —— 这是防串号的代码级保证。
 */

export interface LayerInfo {
  id: string
  name: string
  tokens: number
  chars: number
  /** 是否因为预算不足被裁剪 */
  trimmed?: boolean
}

export interface BuildContextInput {
  profile: Profile
  persona: Persona
  /** 该对象的全部历史消息（升序）。函数内部只取最近若干轮，更早的走摘要。 */
  history: Message[]
  /** 本次要处理的输入：对方的消息，或我自己的草稿 */
  input: string
  /** 附加场景/语气要求 */
  extra?: string
  settings: AppSettings
}

export interface BuiltContext {
  messages: ChatMessage[]
  layers: LayerInfo[]
  estimatedTokens: number
  /** 实际带上了最近多少轮原文 */
  recentTurns: number
  /** 有多少条早期消息被压成摘要 */
  summarizedCount: number
}

function layer(id: string, name: string, content: string, trimmed = false): LayerInfo {
  return { id, name, tokens: estimateTokens(content), chars: content.length, trimmed }
}

function section(title: string, body: string): string {
  return body.trim() ? `## ${title}\n${body.trim()}` : ''
}

function buildL1(): string {
  return section('角色设定（SKILL.md）', haiwangSkill.skill)
}

function buildL2(): string {
  return section('可用知识库（knowledge.md）', haiwangSkill.knowledge)
}

function buildL3(persona: Persona): string {
  const lines: string[] = []
  if (persona.nickname) lines.push(`- 我的昵称/代号：${persona.nickname}`)
  if (persona.age) lines.push(`- 我的年龄：${persona.age}`)
  if (persona.traits) lines.push(`- 我的性格：${persona.traits}`)
  if (persona.speechStyle) lines.push(`- 我的说话风格：${persona.speechStyle}`)
  if (persona.boundaries) lines.push(`- 我的绝对底线：${persona.boundaries}`)
  if (lines.length === 0) return ''
  return section(
    '我的人设卡（所有话术必须是「我」在说，风格需与人设一致）',
    lines.join('\n'),
  )
}

function buildL4(profile: Profile): string {
  const stage = STAGE_META[profile.stage]
  const lines = [
    `- 昵称/代号：${profile.name}`,
    `- 认识渠道：${profile.source || '未填写'}`,
    `- 关系阶段：${stage.label}`,
    `- 本阶段策略：${stage.hint}`,
  ]
  if (profile.likes) lines.push(`- TA 的喜好：${profile.likes}`)
  if (profile.dislikes) lines.push(`- TA 的禁忌（绝对不能碰）：${profile.dislikes}`)
  if (profile.notes) lines.push(`- 关键信息与进度：${profile.notes}`)
  if (profile.chatWindow) lines.push(`- 常聊时段：${profile.chatWindow}`)

  return section(
    `当前聊天对象档案（本次只为「${profile.name}」生成话术，绝不可混入其他对象的信息）`,
    lines.join('\n'),
  )
}

/** 把早期消息压成一行行摘要（确定性压缩，不额外消耗 API 调用） */
function compressHistory(messages: Message[]): string {
  return messages
    .map((m) => {
      const who = m.role === 'user' ? '我' : 'AI'
      const oneLine = m.content.replace(/\s+/g, ' ').trim()
      const brief = oneLine.length > 70 ? `${oneLine.slice(0, 70)}…` : oneLine
      return `- ${who}：${brief}`
    })
    .join('\n')
}

/** 把结构化结果也压成可读文本，供历史回放使用 */
function messageToPlain(m: Message): string {
  if (m.answer) {
    const cards = m.answer.replies.map((r) => `${r.style}：${r.text}`).join(' / ')
    return cards || m.content
  }
  return m.content
}

function buildL5Content(
  history: Message[],
  budgetTokens: number,
): { content: string; recentTurns: number; summarizedCount: number; trimmed: boolean } {
  const usable = history.filter((m) => !m.error)
  if (usable.length === 0) {
    return { content: '', recentTurns: 0, summarizedCount: 0, trimmed: false }
  }

  const parts: string[] = []
  let budget = budgetTokens

  // 从最新往旧装原文
  const recent: Message[] = []
  let cutIndex = 0
  for (let i = usable.length - 1; i >= 0; i -= 1) {
    const m = usable[i]
    const text = messageToPlain(m)
    const cost = estimateTokens(text) + 12
    if (budget - cost < 0 && recent.length > 0) {
      cutIndex = i + 1
      break
    }
    budget -= cost
    recent.unshift(m)
    cutIndex = i
  }

  const older = usable.slice(0, cutIndex)

  if (older.length > 0) {
    const summaryText = compressHistory(older)
    parts.push(`${MEMORY_SUMMARY_HEADER}\n${summaryText}`)
  }

  if (recent.length > 0) {
    const body = recent
      .map((m) => `${m.role === 'user' ? '我' : 'AI'}：${messageToPlain(m)}`)
      .join('\n')
    parts.push(`${MEMORY_RECENT_HEADER}\n${body}`)
  }

  return {
    content: parts.join('\n\n'),
    recentTurns: Math.floor(recent.length / 2),
    summarizedCount: older.length,
    trimmed: older.length > 0,
  }
}

function buildL6(
  profile: Profile,
  persona: Persona,
  input: string,
  extra?: string,
): string {
  const stage = STAGE_META[profile.stage]
  const chunks: string[] = []

  chunks.push(haiwangSkill.prompt.trim())

  chunks.push(
    [
      '## 本次任务',
      `我正在和「${profile.name}」聊天，当前关系阶段是「${stage.label}」。`,
      '',
      '下面是需要你处理的内容（可能是 TA 发来的消息，也可能是我准备发出的草稿）：',
      '"""',
      input.trim(),
      '"""',
    ].join('\n'),
  )

  if (extra?.trim()) {
    chunks.push(`## 我的额外要求\n${extra.trim()}`)
  }

  const traits = [persona.traits, persona.speechStyle].filter(Boolean).join('；')
  if (traits) {
    chunks.push(`## 口吻要求\n所有话术必须符合我的人设：${traits}`)
  }

  chunks.push(OUTPUT_CONTRACT)

  return section('任务指令（prompt.txt）', chunks.join('\n\n'))
}

export function buildContext(input: BuildContextInput): BuiltContext {
  const { profile, persona, history, settings } = input

  const l1 = buildL1()
  const l2 = buildL2()
  const l3 = buildL3(persona)
  const l4 = buildL4(profile)
  const l6 = buildL6(profile, persona, input.input, input.extra)

  const fixedTokens =
    estimateTokens(l1) + estimateTokens(l2) + estimateTokens(l3) + estimateTokens(l4) + estimateTokens(l6)

  // 预留给输出 + 安全余量。
  //
  // 注意：不能把 maxTokens 原样当作预留，否则用户把输出上限拉到 128k 而上下文
  // 窗口还是 32k 时，L5 记忆层会被直接挤空（预算算成负数）。这里对预留做 60% 封顶，
  // 保证「输入 + 输出」之和不会超过窗口，同时记忆层始终有位置。
  const contextWindow = settings.contextWindow || 32768
  const wantReserve = Math.max(settings.maxTokens || 1024, 512)
  const reserve = Math.min(wantReserve, Math.floor(contextWindow * 0.6)) + 500
  const memoryBudget = Math.max(contextWindow - reserve - fixedTokens, 300)

  const l5 = buildL5Content(history, memoryBudget)

  const systemContent = [l1, l2, l3, l4, l5.content].filter(Boolean).join('\n\n---\n\n')

  const messages: ChatMessage[] = [
    { role: 'system', content: systemContent },
    { role: 'user', content: l6 },
  ]

  const layers: LayerInfo[] = [
    layer('L1', '角色层 SKILL.md', l1),
    layer('L2', '知识层 knowledge.md', l2),
    layer('L3', '人设层', l3),
    layer('L4', '对象层', l4),
    layer('L5', '记忆层', l5.content, l5.trimmed),
    layer('L6', '任务层', l6),
  ]

  return {
    messages,
    layers,
    estimatedTokens: systemContent.length
      ? estimateTokens(systemContent) + estimateTokens(l6)
      : estimateTokens(l6),
    recentTurns: l5.recentTurns,
    summarizedCount: l5.summarizedCount,
  }
}
