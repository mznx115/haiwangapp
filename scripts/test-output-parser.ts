/**
 * outputParser 的可执行测试。
 *
 * 用 Node 内置的 TypeScript 类型擦除直接跑（Node 22.18+ 默认开启），
 * 不引入 vitest 等额外依赖。
 *
 *   node scripts/test-output-parser.ts
 */
import { parseAnswer } from '../src/core/skill/outputParser.ts'

interface Case {
  name: string
  input: string
  expectStrategy: 'strict' | 'repaired' | 'balanced' | 'fallback'
  expectReplies: number
}

const GOOD = {
  analysis: '对方态度积极，处于暧昧期。',
  replies: [
    { style: '稳妥版', text: '你今天是不是有点想我了', scenario: '晚上闲聊时', risk: '对方若冷淡就停止推进' },
    { style: '升温版', text: '完了，我好像有点上头了', scenario: '聊得热络时', risk: '节奏过快可能吓到对方' },
    { style: '幽默版', text: '你这话说得，我都想给你颁个奖了', scenario: '对方开玩笑时', risk: '无' },
  ],
  next_step: '保持当前频率，两天后尝试约见面。',
  warnings: ['多线聊天注意隐私'],
}

const cases: Case[] = [
  {
    name: '1. 纯 JSON（最理想）',
    input: JSON.stringify(GOOD),
    expectStrategy: 'strict',
    expectReplies: 3,
  },
  {
    name: '2. ```json 代码围栏包裹',
    input: '```json\n' + JSON.stringify(GOOD) + '\n```',
    expectStrategy: 'strict',
    expectReplies: 3,
  },
  {
    name: '3. JSON 前有解释性文字（括号配平截取）',
    input: '好的，我分析了一下：\n' + JSON.stringify(GOOD) + '\n希望对你有帮助！',
    expectStrategy: 'balanced',
    expectReplies: 3,
  },
  {
    name: '4. 尾逗号 + 注释（轻度修复）',
    input: `{
      // 这是分析
      "analysis": "对方有点敷衍",
      "replies": [
        { "style": "稳妥版", "text": "在忙吗？", "scenario": "隔天", "risk": "无", },
        { "style": "降温版", "text": "那你先忙～", "scenario": "对方回得慢", "risk": "无" },
        { "style": "幽默版", "text": "你是不是把我忘了", "scenario": "两天没回", "risk": "可能显得黏" },
      ],
      "next_step": "主动后撤，降低频率",
      "warnings": ["不要连续发消息"],
    }`,
    expectStrategy: 'repaired',
    expectReplies: 3,
  },
  {
    name: '5. 中文 key（话术/场景/风险）',
    input: JSON.stringify({
      分析: '刚认识，安全区',
      话术: [
        { 风格: '稳妥版', 话术: '看你喜欢猫，我也超爱', 场景: '破冰', 风险: '无' },
        { 风格: '轻松版', 话术: '冒昧打个招呼～', 场景: '初次', 风险: '可能被忽略' },
      ],
      节奏建议: '先观察回复速度',
      风险提示: ['别急着推进'],
    }),
    expectStrategy: 'strict',
    expectReplies: 2,
  },
  {
    name: '6. replies 是对象映射 {风格: 文本}',
    input: JSON.stringify({
      analysis: '暧昧期',
      replies: {
        稳妥版: '今天过得怎么样？',
        升温版: '有点想你了',
        幽默版: '你再不回我我就要报警了',
      },
    }),
    expectStrategy: 'strict',
    expectReplies: 3,
  },
  {
    name: '7. replies 是纯字符串数组',
    input: JSON.stringify({
      analysis: '初识',
      replies: ['你好呀', '在忙什么呢', '看你头像挺有意思'],
    }),
    expectStrategy: 'strict',
    expectReplies: 3,
  },
  {
    name: '8. 完全不是 JSON（必须降级，不能白屏）',
    input: '我觉得你可以这样说：今天天气不错，要不要一起喝杯咖啡？',
    expectStrategy: 'fallback',
    expectReplies: 0,
  },
  {
    name: '9. JSON 合法但字段全空（视为无效 → 降级）',
    input: '{"foo":"bar"}',
    expectStrategy: 'fallback',
    expectReplies: 0,
  },
  {
    name: '10. 中文引号与尾逗号混合',
    input: `{
      “analysis”: “对方在试探”,
      “replies”: [
        {“style”: “稳妥版”, “text”: “你怎么突然这么会说话”, “scenario”: “被夸时”, “risk”: “无”},
      ],
    }`,
    expectStrategy: 'repaired',
    expectReplies: 1,
  },
]

let passed = 0
let failed = 0

for (const c of cases) {
  const r = parseAnswer(c.input)
  const gotReplies = r.answer?.replies.length ?? 0
  const ok = r.strategy === c.expectStrategy && gotReplies === c.expectReplies
  if (ok) {
    passed += 1
    console.log(`  ✓ ${c.name}  [${r.strategy}, ${gotReplies} 条]`)
  } else {
    failed += 1
    console.log(
      `  ✗ ${c.name}\n      期望 strategy=${c.expectStrategy} replies=${c.expectReplies}` +
        `\n      实际 strategy=${r.strategy} replies=${gotReplies}`,
    )
  }
}

console.log(`\n结果：${passed} 通过 / ${failed} 失败（共 ${cases.length}）`)
process.exit(failed === 0 ? 0 : 1)
