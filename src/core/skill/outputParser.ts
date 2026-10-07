import type { ReplyCard, SkillAnswer } from '@/types'

/**
 * 结构化输出的三级容错解析。
 *
 * 1. 剥离代码围栏后 JSON.parse
 * 2. 轻度修复（尾逗号 / 注释 / 中文引号 / 单引号）后再 parse
 * 3. 括号配平截取第一个 JSON 对象再 parse
 * 4. 全部失败 → 降级为纯文本，绝不白屏
 */

export interface ParseOutcome {
  answer: SkillAnswer | null
  /** 降级为纯文本时为 true，UI 直接按 Markdown 渲染 raw */
  fallback: boolean
  raw: string
  /** 命中了哪一级策略，便于排查 */
  strategy: 'strict' | 'repaired' | 'balanced' | 'fallback'
}

function stripFences(text: string): string {
  const fenced = text.match(/```(?:json|JSON)?\s*([\s\S]*?)```/)
  if (fenced?.[1]) return fenced[1].trim()
  return text.trim()
}

function repair(text: string): string {
  return (
    text
      // 去掉 // 与 /* */ 注释
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:"'\\])\/\/[^\n\r]*/g, '$1')
      // 中文标点误用
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      // 尾逗号
      .replace(/,(\s*[}\]])/g, '$1')
  )
}

/** 从任意文本里截出第一个括号配平的 JSON 对象 */
function extractBalanced(text: string): string | null {
  const start = text.indexOf('{')
  if (start < 0) return null

  let depth = 0
  let inString = false
  let escaped = false

  for (let i = start; i < text.length; i += 1) {
    const ch = text[i]
    if (inString) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') inString = true
    else if (ch === '{') depth += 1
    else if (ch === '}') {
      depth -= 1
      if (depth === 0) return text.slice(start, i + 1)
    }
  }
  return null
}

function tryParse(text: string): unknown | null {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

/* ---------- 字段归一化：兼容模型自作主张改 key 名 ---------- */

function pickString(obj: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = obj[k]
    if (typeof v === 'string' && v.trim()) return v.trim()
    if (typeof v === 'number') return String(v)
  }
  return ''
}

function normalizeCard(raw: unknown, index: number): ReplyCard {
  const fallbackStyles = ['稳妥版', '升温版', '幽默版']
  if (typeof raw === 'string') {
    return {
      style: fallbackStyles[index] ?? `方案 ${index + 1}`,
      text: raw.trim(),
      scenario: '',
      risk: '',
    }
  }
  const obj = (raw ?? {}) as Record<string, unknown>
  return {
    style: pickString(obj, ['style', '风格', 'label', 'name', 'type']) || fallbackStyles[index] || `方案 ${index + 1}`,
    text: pickString(obj, ['text', 'content', '话术', 'reply', 'message', '内容']),
    scenario: pickString(obj, ['scenario', '场景', 'when', 'usage', '适用场景']),
    risk: pickString(obj, ['risk', '风险', 'warning', '风险提示', 'note']),
  }
}

function normalizeWarnings(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((v) => (typeof v === 'string' ? v.trim() : String((v as { text?: string })?.text ?? '')))
      .filter(Boolean)
  }
  if (typeof value === 'string' && value.trim()) return [value.trim()]
  return []
}

function normalize(json: unknown): SkillAnswer | null {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return null
  const obj = json as Record<string, unknown>

  const rawReplies =
    obj.replies ?? obj.cards ?? obj['话术'] ?? obj['方案'] ?? obj.reply ?? obj.answers

  let replies: ReplyCard[] = []
  if (Array.isArray(rawReplies)) {
    replies = rawReplies.map((r, i) => normalizeCard(r, i))
  } else if (rawReplies && typeof rawReplies === 'object') {
    // 形如 { "稳妥版": "...", "升温版": "..." }
    replies = Object.entries(rawReplies as Record<string, unknown>).map(([k, v], i) =>
      normalizeCard(typeof v === 'string' ? { style: k, text: v } : { style: k, ...(v as object) }, i),
    )
  }

  replies = replies.filter((r) => r.text.length > 0)

  const analysis = pickString(obj, ['analysis', '分析', '判断', 'assessment'])
  const nextStep = pickString(obj, ['next_step', 'nextStep', '节奏建议', 'next', 'suggestion'])
  const warnings = normalizeWarnings(obj.warnings ?? obj['风险提示'] ?? obj.risks)

  if (replies.length === 0 && !analysis && !nextStep) return null

  return { analysis, replies, nextStep, warnings }
}

export function parseAnswer(raw: string): ParseOutcome {
  const text = raw ?? ''
  const stripped = stripFences(text)

  const strict = tryParse(stripped)
  if (strict) {
    const normalized = normalize(strict)
    if (normalized) return { answer: normalized, fallback: false, raw: text, strategy: 'strict' }
  }

  const repaired = tryParse(repair(stripped))
  if (repaired) {
    const normalized = normalize(repaired)
    if (normalized) return { answer: normalized, fallback: false, raw: text, strategy: 'repaired' }
  }

  const balanced = extractBalanced(stripped)
  if (balanced) {
    const parsed = tryParse(repair(balanced))
    if (parsed) {
      const normalized = normalize(parsed)
      if (normalized) return { answer: normalized, fallback: false, raw: text, strategy: 'balanced' }
    }
  }

  return { answer: null, fallback: true, raw: text, strategy: 'fallback' }
}
