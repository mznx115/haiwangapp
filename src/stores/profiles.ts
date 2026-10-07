import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { Profile, RelationStage } from '@/types'
import { pickAvatarColor } from '@/core/stage'

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function makeProfile(name: string, stage: RelationStage, source: string, notes: string): Profile {
  const now = Date.now()
  return {
    id: uid(),
    name,
    source,
    stage,
    themeColor: pickAvatarColor(name),
    likes: '',
    dislikes: '',
    notes,
    chatWindow: '',
    archived: false,
    createdAt: now,
    updatedAt: now,
  }
}

/**
 * 多对象档案 store
 *
 * M0 阶段为内存态 + 演示数据；M4 接入 SQLite 持久化后，
 * 所有读取仍然强制按 profileId 过滤（防串号的数据层保证）。
 */
export const useProfilesStore = defineStore('profiles', () => {
  const profiles = ref<Profile[]>([
    makeProfile('小雅', 'flirty', '社交软件', '上次聊到她想去看的那个展'),
    makeProfile('阿宁', 'friend', '朋友介绍', '刚换工作，最近比较忙'),
    makeProfile('林林', 'stranger', '线下活动', '加了微信还没正式聊过'),
  ])

  const activeProfiles = computed(() =>
    [...profiles.value].filter((p) => !p.archived).sort((a, b) => b.updatedAt - a.updatedAt),
  )

  /** 按 id 取档案 —— 唯一允许的访问路径 */
  function byId(id: string): Profile | undefined {
    return profiles.value.find((p) => p.id === id)
  }

  function add(profile: Omit<Profile, 'id' | 'createdAt' | 'updatedAt' | 'themeColor' | 'archived'>) {
    const now = Date.now()
    const created: Profile = {
      ...profile,
      id: uid(),
      themeColor: pickAvatarColor(profile.name),
      archived: false,
      createdAt: now,
      updatedAt: now,
    }
    profiles.value.unshift(created)
    return created
  }

  function touch(id: string) {
    const p = byId(id)
    if (p) p.updatedAt = Date.now()
  }

  function setStage(id: string, stage: RelationStage) {
    const p = byId(id)
    if (p) {
      p.stage = stage
      p.updatedAt = Date.now()
    }
  }

  function createDemo() {
    const n = profiles.value.length + 1
    return add({
      name: `新对象 ${n}`,
      source: '手动添加',
      stage: 'stranger',
      likes: '',
      dislikes: '',
      notes: '',
      chatWindow: '',
    })
  }

  return { profiles, activeProfiles, byId, add, touch, setStage, createDemo }
})
