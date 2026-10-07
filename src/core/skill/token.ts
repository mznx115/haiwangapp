/**
 * 粗略 token 估算。
 *
 * 中文按接近 1 字 ≈ 1 token 计算（cl100k 系词表下 CJK 通常 1~2 token/字），
 * 英文/数字按 4 字符 ≈ 1 token。刻意偏保守（高估），宁可按预算少放历史，
 * 也不要因为低估而把上下文撑爆。
 */
export function estimateTokens(text: string): number {
  if (!text) return 0
  let cjk = 0
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0
    const isCjk =
      (code >= 0x3000 && code <= 0x303f) || // CJK 标点
      (code >= 0x3400 && code <= 0x4dbf) || // 扩展 A
      (code >= 0x4e00 && code <= 0x9fff) || // 基本区
      (code >= 0xf900 && code <= 0xfaff) || // 兼容表意
      (code >= 0xff00 && code <= 0xffef) // 全角
    if (isCjk) cjk += 1
  }
  const rest = [...text].length - cjk
  return Math.ceil(cjk * 1.1 + rest / 4)
}

export function estimateMessagesTokens(messages: { content: string }[]): number {
  // 每条消息约 4 token 的结构开销
  return messages.reduce((sum, m) => sum + estimateTokens(m.content) + 4, 0)
}
