import type { RelationStage } from '@/types'

export interface StageMeta {
  label: string
  color: string
  /** 给模型的阶段提示 */
  hint: string
}

export const STAGE_META: Record<RelationStage, StageMeta> = {
  stranger: {
    label: '初识',
    color: '#9AA0A6',
    hint: '初次认识，处于安全区。只做低压、无风险的互动，不推进、不暧昧。',
  },
  friend: {
    label: '朋友',
    color: '#4C8DFF',
    hint: '朋友关系，需要保持边界感。可以稳定陪伴、真诚互动，但不越界、不制造暧昧误会。',
  },
  flirty: {
    label: '暧昧',
    color: '#FF6B81',
    hint: '暧昧阶段，可以适度升温、制造心动感，但每次推进都必须依据对方上一轮的反馈，对方冷淡则立即后撤。',
  },
  stable: {
    label: '稳定',
    color: '#07C160',
    hint: '已进入稳定关系，重点在经营节奏与长期吸引力，不需要再用力推进。',
  },
}

export const STAGE_ORDER: RelationStage[] = ['stranger', 'friend', 'flirty', 'stable']

/** 头像取色盘 */
export const AVATAR_COLORS = [
  '#FF6B81',
  '#4C8DFF',
  '#07C160',
  '#FFA940',
  '#9254DE',
  '#13C2C2',
  '#F759AB',
  '#597EF7',
]

export function pickAvatarColor(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}
