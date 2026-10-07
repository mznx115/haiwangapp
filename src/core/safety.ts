/**
 * 输出后置安全校验。
 *
 * 技能包自带「绝对禁止」条款（已进 L1 系统提示），但模型仍可能越界。
 * 这里做一层轻量的关键词审查：命中就追加提醒，而不是粗暴地屏蔽内容
 * —— 拦截交给用户在 UI 上判断，避免误杀正常话术。
 */

const RISKY_PATTERNS: { pattern: RegExp; warning: string }[] = [
  {
    pattern: /(脚踏(两|多)只船|养鱼|备胎计划|多线并行不冲突)/,
    warning: '提醒：同时经营多段关系可能伤害他人，请确认你愿意承担相应后果。',
  },
  {
    pattern: /(PUA|打压|贬低(她|他|对方)|冷暴力|忽冷忽热.*控制)/i,
    warning: '提醒：涉及情感操控的内容不建议使用，这既伤害对方也会反噬你自己。',
  },
  {
    pattern: /(骗|谎称|假装.*(单身|有钱|身份)|隐瞒.*(已婚|恋爱|婚姻))/,
    warning: '提醒：任何形式的欺骗都会让关系失去基础，建议坦诚沟通。',
  },
  {
    pattern: /(纠缠|死缠烂打|夺命连环|不停发消息直到)/,
    warning: '提醒：对方明确拒绝后继续推进属于骚扰，请立即停止。',
  },
  {
    pattern: /(深夜.*独自.*(酒店|家里)|灌醉|下药|趁.*不清醒)/,
    warning: '提醒：涉及人身安全与自愿原则，请务必尊重对方意愿与边界。',
  },
]

/** 返回需要追加到 warnings 的提示（可能为空数组） */
export function checkOutputSafety(text: string): string[] {
  if (!text) return []
  const hits: string[] = []
  for (const { pattern, warning } of RISKY_PATTERNS) {
    if (pattern.test(text) && !hits.includes(warning)) hits.push(warning)
  }
  return hits
}

/** 输入侧的轻量提醒（不阻断，只提示） */
export function checkInputSafety(text: string): string[] {
  if (!text) return []
  const hints: string[] = []
  if (/(未成年|初中|高中|14岁|15岁|16岁|17岁)/.test(text)) {
    hints.push('涉及未成年人时请务必保持绝对边界，任何越界行为都涉嫌违法。')
  }
  return hints
}
