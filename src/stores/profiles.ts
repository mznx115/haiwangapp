import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import type { Profile, RelationStage } from '@/types'
import { pickAvatarColor } from '@/core/stage'
import { K, readJson, writeJson } from '@/db/storage'

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export type ProfileDraft = Pick<
  Profile,
  'name' | 'source' | 'stage' | 'likes' | 'dislikes' | 'notes' | 'chatWindow' | 'themeColor'
>

function makeProfile(draft: ProfileDraft): Profile {
  const now = Date.now()
  return {
    ...draft,
    id: uid(),
    themeColor: draft.themeColor || pickAvatarColor(draft.name),
    archived: false,
    createdAt: now,
    updatedAt: now,
  }
}

/** 仅在开发模式下预置演示数据，正式包启动就是干净的 */
function seedIfDev(): Profile[] {
  if (!import.meta.env.DEV) return []
  return [
    makeProfile({
      name: '小雅',
      source: '社交软件',
      stage: 'flirty',
      themeColor: pickAvatarColor('小雅'),
      likes: '看展、手冲咖啡、猫',
      dislikes: '别人一直追问她在干嘛',
      notes: '上次聊到她想去看的那个展，还没约',
      chatWindow: '晚上 21:00-23:00',
    }),
    makeProfile({
      name: '阿宁',
      source: '朋友介绍',
      stage: 'friend',
      themeColor: pickAvatarColor('阿宁'),
      likes: '',
      dislikes: '',
      notes: '刚换工作，最近比较忙',
      chatWindow: '',
    }),
  ]
}

function load(): Profile[] {
  const stored = readJson<Profile[] | null>(K.profiles, null)
  if (Array.isArray(stored)) return stored
  return seedIfDev()
}

/**
 * 多对象档案 store。
 *
 * 防串号的数据层保证：所有读取都必须经过 byId(id)，
 * 不存在「取全部消息」这类接口。
 */
export const useProfilesStore = defineStore('profiles', () => {
  const profiles = ref<Profile[]>(load())

  const activeProfiles = computed(() =>
    [...profiles.value].filter((p) => !p.archived).sort((a, b) => b.updatedAt - a.updatedAt),
  )

  const archivedProfiles = computed(() =>
    [...profiles.value].filter((p) => p.archived).sort((a, b) => b.updatedAt - a.updatedAt),
  )

  /** 按 id 取档案 —— 唯一允许的访问路径 */
  function byId(id: string): Profile | undefined {
    return profiles.value.find((p) => p.id === id)
  }

  function create(draft: ProfileDraft): Profile {
    const created = makeProfile(draft)
    profiles.value.unshift(created)
    return created
  }

  function update(id: string, patch: Partial<ProfileDraft>): boolean {
    const p = byId(id)
    if (!p) return false
    Object.assign(p, patch)
    if (patch.name || patch.themeColor === undefined) {
      // 昵称变了但没显式指定颜色时，跟随新昵称重新取色
      if (patch.name && !patch.themeColor) p.themeColor = pickAvatarColor(patch.name)
    }
    p.updatedAt = Date.now()
    return true
  }

  function setStage(id: string, stage: RelationStage) {
    const p = byId(id)
    if (p) {
      p.stage = stage
      p.updatedAt = Date.now()
    }
  }

  function touch(id: string) {
    const p = byId(id)
    if (p) p.updatedAt = Date.now()
  }

  function archive(id: string) {
    const p = byId(id)
    if (p) {
      p.archived = true
      p.updatedAt = Date.now()
    }
  }

  function unarchive(id: string) {
    const p = byId(id)
    if (p) {
      p.archived = false
      p.updatedAt = Date.now()
    }
  }

  function remove(id: string) {
    profiles.value = profiles.value.filter((p) => p.id !== id)
  }

  let timer: number | undefined
  watch(
    profiles,
    (v) => {
      // 防抖：连续编辑时不要每次都写
      window.clearTimeout(timer)
      timer = window.setTimeout(() => writeJson(K.profiles, v), 250)
    },
    { deep: true },
  )

  return {
    profiles,
    activeProfiles,
    archivedProfiles,
    byId,
    create,
    update,
    setStage,
    touch,
    archive,
    unarchive,
    remove,
  }
})
