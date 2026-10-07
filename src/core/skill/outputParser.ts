import type { ReplyCard, SkillAnswer } from '@/types'

/**
 * 结构化输出的多级容错解析。
 *
 * 实测中最常见的两种失败：
 *   1. 输出被 max_tokens 截断 —— JSON 缺收尾括号，永远 parse 不出来
 *   2. 模型在字符串里吐了真实换行 —— 严格来说非法 JSON（Bad control character）
 *
 * 策略顺序：
 *   strict    去代码围栏后直接 parse
 *   repaired  修复注释 / 尾逗号 / 中文引号 / 字符串内裸控制字符
 *   balanced  括号配平截出第一个完整对象再 parse
 *   salvaged  输出被截断时，补全残缺的字符串与括号，尽量抢救出已完成的话术
 *   fallback  实在救不回来 → 按纯文本渲染，绝不白屏
 */

export type ParseStrategy = 'strict' | 'repaired' | 'balanced' | 'salvaged' | 'fallback'

export interface ParseOutcome {
  answer: SkillAnswer | null
  /** 降级为纯文本时为 true，UI 直接渲染 raw */
  fallback: boolean
  raw: string
  strategy: ParseStrategy
  /** 是否从截断的输出里抢救出来的（UI 需要提示用户调大 max_tokens） */
  truncated: boolean
}

function stripFences(text: string): string {
  const fenced = text.match(/```(?:json|JSON)?\s*([\s\S]*?)```/)
  if (fenced?.[1]) return fenced[1].trim()
  return text.trim()
}

/**
 * 把 JSON 字符串内部裸的换行/制表符转义掉。
 * 模型经常直接输出真换行，导致 JSON.parse 报 control character 错误。
 */
function escapeControlCharsInStrings(text: string): string {
  let out = ''
  let inString = false
  let escaped = false

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
    if (inString) {
      if (escaped) {
        out += ch
        escaped = false
        continue
      }
      if (ch === '\\') {
        out += ch
        escaped = true
        continue
      }
      if (ch === '"') {
        out += ch
        inString = false
        continue
      }
      if (ch === '\n') {
        out += '\\n'
        continue
      }
      if (ch === '\r') {
        out += '\\r'
        continue
      }
      if (ch === '\t') {
        out += '\\t'
        continue
      }
      out += ch
      continue
    }
    if (ch === '"') inString = true
    out += ch
  }
  return out
}

function repair(text: string): string {
  return escapeControlCharsInStrings(
    text
      // 去掉 // 与 /* */ 注释
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:"'\\])\/\/[^\n\r]*/g, '$1')
      // 中文标点误用
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      // 尾逗号
      .replace(/,(\s*[}\]])/g, '$1'),
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

/**
 * 把被截断的 JSON 补全成合法 JSON。
 *
 * 例：`{"analysis":"...","replies":[{"style":"稳妥版","text":"我平时`
 *  → 收尾补 `"}]}`，并把残缺的 `"text":` 之类清理掉。
 */
function closeTruncated(text: string): string | null {
  const start = text.indexOf('{')
  if (start < 0) return null

  let s = text.slice(start)
  const stack: string[] = []
  let inString = false
  let escaped = false

  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i]
    if (inString) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') inString = true
    else if (ch === '{' || ch === '[') stack.push(ch)
    else if (ch === '}' || ch === ']') stack.pop()
  }

  if (inString) {
    // 截断在字符串中间：补上引号，这段内容当成已完成的字符串保留下来
    s += '"'
  } else {
    // 截断在 `"key":` 这种半截位置上：这个字段整个丢掉
    s = s.replace(/"([^"\\]|\\.)*"\s*:\s*$/, '')
  }

  // 去掉悬空的逗号
  s = s.replace(/,\s*$/, '')

  // 恰好停在容器开头：直接折叠成空容器，并同步弹出栈
  if (/\[\s*$/.test(s)) {
    s = `${s.slice(0, s.lastIndexOf('['))}[]`
    const idx = stack.lastIndexOf('[')
    if (idx >= 0) stack.splice(idx, 1)
  } else if (/\{\s*$/.test(s)) {
    s = `${s.slice(0, s.lastIndexOf('{'))}{}`
    const idx = stack.lastIndexOf('{')
    if (idx >= 0) stack.splice(idx, 1)
  }

  // 补齐未闭合的括号
  for (let i = stack.length - 1; i >= 0; i -= 1) {
    s += stack[i] === '{' ? '}' : ']'
  }

  return s
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
    style:
      pickString(obj, ['style', '风格', 'label', 'name', 'type']) ||
      fallbackStyles[index] ||
      `方案 ${index + 1}`,
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

function ok(json: unknown, raw: string, strategy: ParseStrategy): ParseOutcome | null {
  const normalized = normalize(json)
  if (!normalized) return null
  return { answer: normalized, fallback: false, raw, strategy, truncated: strategy === 'salvaged' }
}

export function parseAnswer(raw: string): ParseOutcome {
  const text = raw ?? ''
  const stripped = stripFences(text)

  const strict = ok(tryParse(stripped), text, 'strict')
  if (strict) return strict

  const repairedText = repair(stripped)
  const repaired = ok(tryParse(repairedText), text, 'repaired')
  if (repaired) return repaired

  const balanced = extractBalanced(repairedText)
  if (balanced) {
    const r = ok(tryParse(repair(balanced)), text, 'balanced')
    if (r) return r
  }

  // 最后一道：按「被截断」处理，尽量抢救
  const closed = closeTruncated(repairedText)
  if (closed) {
    const r = ok(tryParse(closed), text, 'salvaged')
    if (r) return r
  }

  return { answer: null, fallback: true, raw: text, strategy: 'fallback', truncated: false }
}
