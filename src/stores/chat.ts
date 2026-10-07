import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { Message, ReplyCard, SkillAnswer } from '@/types'
import { chat as apiChat } from '@/core/api/client'
import { describeError, type FriendlyError } from '@/core/api/errors'
import { buildContext, type LayerInfo } from '@/core/skill/contextBuilder'
import { parseAnswer } from '@/core/skill/outputParser'
import { useProfilesStore } from './profiles'
import { useSettingsStore } from './settings'
import { checkOutputSafety } from '@/core/safety'
import { K, readJson, writeJson } from '@/db/storage'

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export interface LastMeta {
  layers: LayerInfo[]
  estimatedTokens: number
  recentTurns: number
  summarizedCount: number
  strategy: string
  /** 本次实际走的传输通道说明（原生兜底时会提示已退化为非流式） */
  transportNote?: string
}

/**
 * 会话 store。
 *
 * 防串号的数据层保证：所有数据都存在以 profileId 为键的分片里，
 * 对外只暴露 list(profileId) —— 没有任何「取全部消息」的接口。
 */
export const useChatStore = defineStore('chat', () => {
  const profiles = useProfilesStore()
  const settings = useSettingsStore()

  /** profileId -> 该对象的消息，彼此物理隔离 */
  const byProfile = ref<Record<string, Message[]>>(
    readJson<Record<string, Message[]>>(K.messages, {}),
  )
  const generating = ref<Record<string, boolean>>({})
  const lastError = ref<Record<string, FriendlyError | null>>({})
  const lastMeta = ref<Record<string, LastMeta | null>>({})

  const controllers = new Map<string, AbortController>()

  let saveTimer: number | undefined

  /** 落盘。流式生成期间不要调用，等一轮结束再存，避免每个 token 都写一次。 */
  function persist(immediate = false) {
    if (immediate) {
      window.clearTimeout(saveTimer)
      writeJson(K.messages, byProfile.value)
      return
    }
    window.clearTimeout(saveTimer)
    saveTimer = window.setTimeout(() => writeJson(K.messages, byProfile.value), 300)
  }

  /** 唯一的读取入口，必须传 profileId */
  function list(profileId: string): Message[] {
    return byProfile.value[profileId] ?? []
  }

  function ensure(profileId: string): Message[] {
    if (!byProfile.value[profileId]) byProfile.value[profileId] = []
    return byProfile.value[profileId]
  }

  function isGenerating(profileId: string): boolean {
    return Boolean(generating.value[profileId])
  }

  function errorOf(profileId: string): FriendlyError | null {
    return lastError.value[profileId] ?? null
  }

  function metaOf(profileId: string): LastMeta | null {
    return lastMeta.value[profileId] ?? null
  }

  function clear(profileId: string) {
    byProfile.value[profileId] = []
    persist(true)
  }

  /** 删除某个对象的全部记录（删除对象时调用，避免留下孤儿数据） */
  function dropProfile(profileId: string) {
    delete byProfile.value[profileId]
    controllers.get(profileId)?.abort()
    controllers.delete(profileId)
    persist(true)
  }

  function removeMessage(profileId: string, messageId: string) {
    const arr = byProfile.value[profileId]
    if (!arr) return
    byProfile.value[profileId] = arr.filter((m) => m.id !== messageId)
    persist()
  }

  function cancel(profileId: string) {
    controllers.get(profileId)?.abort()
    controllers.delete(profileId)
    generating.value[profileId] = false
  }

  /**
   * 生成话术。
   *
   * 流程：组装六层上下文 → 写入用户消息 → 插入 assistant 占位 → 流式/一次性请求
   *      → 三级解析 → 回填结构化结果
   */
  async function generate(profileId: string, input: string, extra?: string): Promise<boolean> {
    const profile = profiles.byId(profileId)
    if (!profile) return false
    if (!input.trim()) return false
    if (generating.value[profileId]) return false

    lastError.value[profileId] = null
    generating.value[profileId] = true

    const arr = ensure(profileId)

    // 先取出「本次输入之前」的历史，避免把刚写入的用户消息重复算进记忆层
    const history = arr.slice()

    const userMessage: Message = {
      id: uid(),
      profileId,
      role: 'user',
      content: input.trim(),
      createdAt: Date.now(),
    }
    arr.push(userMessage)

    const built = buildContext({
      profile,
      persona: settings.persona,
      history,
      input: input.trim(),
      extra,
      settings: settings.settings,
    })

    lastMeta.value[profileId] = {
      layers: built.layers,
      estimatedTokens: built.estimatedTokens,
      recentTurns: built.recentTurns,
      summarizedCount: built.summarizedCount,
      strategy: '-',
    }

    const assistantMessage: Message = {
      id: uid(),
      profileId,
      role: 'assistant',
      content: '',
      createdAt: Date.now(),
    }
    arr.push(assistantMessage)

    // 关键：push 进去的原始对象不会被 Vue 追踪，
    // 必须取回响应式代理再改，流式渲染才能实时更新。
    const assistant = arr[arr.length - 1]

    const controller = new AbortController()
    controllers.set(profileId, controller)

    try {
      const full = await apiChat(
        { baseUrl: settings.normalizedBaseUrl(), apiKey: settings.settings.apiKey },
        {
          model: settings.settings.model,
          messages: built.messages,
          temperature: settings.settings.temperature,
          max_tokens: settings.settings.maxTokens,
          stream: settings.settings.stream,
        },
        {
          signal: controller.signal,
          onDelta: (delta) => {
            assistant.content += delta
          },
          onTransport: (info) => {
            const meta = lastMeta.value[profileId]
            if (meta) {
              meta.transportNote = info.note ?? (info.mode === 'native' ? '使用系统原生请求（非流式）' : undefined)
            }
          },
        },
      )

      if (!assistant.content) assistant.content = full

      const outcome = parseAnswer(assistant.content)
      const safety = checkOutputSafety(assistant.content)

      if (outcome.answer) {
        const answer: SkillAnswer = { ...outcome.answer }
        if (safety.length > 0) {
          answer.warnings = [...answer.warnings, ...safety]
        }
        assistant.answer = answer
        assistant.rawFallback = false
      } else {
        assistant.rawFallback = true
        if (safety.length > 0) assistant.safety = safety
      }

      const meta = lastMeta.value[profileId]
      if (meta) meta.strategy = outcome.strategy

      profiles.touch(profileId)
      return true
    } catch (err) {
      const friendly = describeError(err)
      lastError.value[profileId] = friendly
      // 失败的请求不留空壳
      if (!assistant.content) removeMessage(profileId, assistant.id)
      else assistant.error = friendly.detail
      return false
    } finally {
      controllers.delete(profileId)
      generating.value[profileId] = false
      assistant.createdAt = Date.now()
      persist(true)
    }
  }

  /** 把一条 assistant 消息里的话术标记为已复制（用于 UI 反馈） */
  function markCopied(profileId: string, messageId: string, cardIndex: number) {
    const m = byProfile.value[profileId]?.find((x) => x.id === messageId)
    if (!m?.answer) return
    const card: ReplyCard | undefined = m.answer.replies[cardIndex]
    if (card) card.copied = true
  }

  const totalMessages = computed(() =>
    Object.values(byProfile.value).reduce((sum, arr) => sum + arr.length, 0),
  )

  /** 供调试面板显示：最近一次请求的上下文 token 估算 */
  function lastRequestTokens(profileId: string): number {
    return lastMeta.value[profileId]?.estimatedTokens ?? 0
  }

  return {
    byProfile,
    generating,
    list,
    isGenerating,
    errorOf,
    metaOf,
    lastMeta,
    clear,
    dropProfile,
    cancel,
    generate,
    markCopied,
    persist,
    totalMessages,
    lastRequestTokens,
  }
})
