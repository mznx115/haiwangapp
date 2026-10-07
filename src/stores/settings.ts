import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import type { AppSettings, Persona } from '@/types'

const SETTINGS_KEY = 'haiwang.settings.v1'
const PERSONA_KEY = 'haiwang.persona.v1'

/**
 * 默认设置。
 *
 * 注意：baseUrl 只是预填一个默认值，**绝不硬编码 API Key**。
 * M4 会把 apiKey 迁移到 Capacitor Secure Storage（Android Keystore）。
 */
export function defaultSettings(): AppSettings {
  return {
    baseUrl: 'http://175.178.98.241:30888/v1',
    apiKey: '',
    model: '',
    temperature: 0.8,
    maxTokens: 1024,
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

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return { ...fallback, ...(JSON.parse(raw) as Partial<T>) }
  } catch {
    return fallback
  }
}

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<AppSettings>(load(SETTINGS_KEY, defaultSettings()))
  const persona = ref<Persona>(load(PERSONA_KEY, defaultPersona()))

  watch(
    settings,
    (v) => {
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(v))
      } catch {
        /* 隐私模式下忽略 */
      }
    },
    { deep: true },
  )

  watch(
    persona,
    (v) => {
      try {
        localStorage.setItem(PERSONA_KEY, JSON.stringify(v))
      } catch {
        /* 隐私模式下忽略 */
      }
    },
    { deep: true },
  )

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

  return { settings, persona, reset, normalizedBaseUrl, isConfigured }
})
