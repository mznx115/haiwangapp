/**
 * 技能包加载器
 *
 * 用 Vite 的 `?raw` 把 haiwang.skill 的三个文本文件内联成字符串常量：
 * 打包后完全离线可用，不依赖运行时访问 GitHub。
 */
import skillMeta from './haiwang/skill.json'
import skillMd from './haiwang/SKILL.md?raw'
import knowledgeMd from './haiwang/knowledge.md?raw'
import promptTxt from './haiwang/prompt.txt?raw'

export interface SkillPackMeta {
  name: string
  description: string
  version: string
  author: string
  source: string
  skill_file: string
  prompt_file: string
  knowledge_file: string
  type: string
  trigger: string
  command: string
}

export interface SkillPack {
  meta: SkillPackMeta
  /** L1 角色层 */
  skill: string
  /** L2 知识层 */
  knowledge: string
  /** L6 任务指令 */
  prompt: string
}

export const haiwangSkill: SkillPack = {
  meta: skillMeta as SkillPackMeta,
  skill: skillMd,
  knowledge: knowledgeMd,
  prompt: promptTxt,
}

export const SKILL_NAME = haiwangSkill.meta.name
export const SKILL_VERSION = haiwangSkill.meta.version
export const SKILL_SOURCE = haiwangSkill.meta.source
