import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import type { AppSettings, Persona } from '@/types'
import { K, readJson, writeJson } from '@/db/storage'

/**
 * 默认设置。
 *
 * 注意：baseUrl 只是预填一个默认值，**绝不硬编码 API Key**。
 * apiKey 目前存在本机 localStorage；迁移到 Android Keystore 加密存储
 * 需要在真机上验证，属于后续版本的工作（见方案.md M4）。
 */
export function defaultSettings(): AppSettings {
  return {
    baseUrl: 'http://175.178.98.241:30888/v1',
    apiKey: '',
    model: '',
    temperature: 0.8,
    // 结构化输出（分析 + 3 条话术 + 场景 + 风险）很吃 token，1024 实测会被截断。
    // 这里给 4096 留足余量；具体上限取决于所用模型，可在设置页按档位调整。
    maxTokens: 4096,
    stream: true,
    contextWindow: 32768,
    summarizeAfter: 12,
  }
}

export function defaultPersona(): Persona {
  return {
    nickname: '',
    age: '',
    traits: '',
    speechStyle: '',
    boundaries: '',
  }
}

function load<T extends object>(key: string, fallback: T): T {
  return { ...fallback, ...readJson<Partial<T>>(key, {}) }
}

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<AppSettings>(load(K.settings, defaultSettings()))
  const persona = ref<Persona>(load(K.persona, defaultPersona()))

  watch(settings, (v) => writeJson(K.settings, v), { deep: true })
  watch(persona, (v) => writeJson(K.persona, v), { deep: true })

  function reset() {
    settings.value = defaultSettings()
  }

  /** 归一化 baseUrl：去掉尾部斜杠 */
  function normalizedBaseUrl(): string {
    return settings.value.baseUrl.trim().replace(/\/+$/, '')
  }

  function isConfigured(): boolean {
    return normalizedBaseUrl().length > 0 && settings.value.apiKey.trim().length > 0
  }

  /** baseUrl 是否为明文 HTTP —— 设置页据此显示醒目告警 */
  function isInsecure(): boolean {
    return /^http:\/\//i.test(normalizedBaseUrl())
  }

  function hasPersona(): boolean {
    return Boolean(persona.value.nickname || persona.value.traits || persona.value.speechStyle)
  }

  return {
    settings,
    persona,
    reset,
    normalizedBaseUrl,
    isConfigured,
    isInsecure,
    hasPersona,
  }
})
