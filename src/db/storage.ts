/**
 * 本地持久化层。
 *
 * 当前实现基于 WebView 的 localStorage（App 私有数据目录，重启不丢）。
 * 之所以先不用 @capacitor-community/sqlite：
 * 它是一个原生插件，本机没有 Android SDK/真机，写了也无法验证，
 * 反而会引入一个「跑不起来但看不出来」的风险点。
 *
 * 因此这里把读写收敛成极薄的一层：以后换 SQLite 只需要替换本文件的实现，
 * 上层 store 完全不用改。
 */

const PREFIX = 'haiwang.v1.'

export const K = {
  profiles: 'profiles',
  messages: 'messages',
  settings: 'settings',
  persona: 'persona',
  favorites: 'favorites',
} as const

export type StorageKey = (typeof K)[keyof typeof K]

function fullKey(key: string): string {
  return `${PREFIX}${key}`
}

export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(fullKey(key))
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    // 数据损坏时宁可回到默认值，也不要让整个 App 起不来
    return fallback
  }
}

/** 写入失败（多为配额溢出）时返回 false，由调用方决定怎么提示 */
export function writeJson(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(fullKey(key), JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export function removeKey(key: string): void {
  try {
    localStorage.removeItem(fullKey(key))
  } catch {
    /* ignore */
  }
}

export interface StorageStats {
  bytes: number
  human: string
  keys: { key: string; bytes: number }[]
}

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

export function stats(): StorageStats {
  const keys: { key: string; bytes: number }[] = []
  let bytes = 0
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i)
      if (!k || !k.startsWith(PREFIX)) continue
      const v = localStorage.getItem(k) ?? ''
      // UTF-16 存储，按 2 字节/字符估算更接近真实占用
      const size = (k.length + v.length) * 2
      keys.push({ key: k.slice(PREFIX.length), bytes: size })
      bytes += size
    }
  } catch {
    /* ignore */
  }
  keys.sort((a, b) => b.bytes - a.bytes)
  return { bytes, human: humanSize(bytes), keys }
}

/** 导出全部本地数据（供备份；不含 API Key 之外的任何服务端信息） */
export function exportAll(): string {
  const data: Record<string, unknown> = {}
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i)
      if (!k || !k.startsWith(PREFIX)) continue
      const v = localStorage.getItem(k)
      if (v === null) continue
      try {
        data[k.slice(PREFIX.length)] = JSON.parse(v)
      } catch {
        data[k.slice(PREFIX.length)] = v
      }
    }
  } catch {
    /* ignore */
  }
  return JSON.stringify(
    { app: 'haiwang', version: 1, exportedAt: new Date().toISOString(), data },
    null,
    2,
  )
}

export interface ImportResult {
  ok: boolean
  message: string
}

export function importAll(raw: string): ImportResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { ok: false, message: '不是合法的 JSON 文件' }
  }
  const data = (parsed as { data?: unknown })?.data
  if (!data || typeof data !== 'object') {
    return { ok: false, message: '缺少 data 字段，可能不是本 App 导出的备份' }
  }
  let count = 0
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (writeJson(key, value)) count += 1
  }
  return { ok: true, message: `已恢复 ${count} 项数据，请重启 App 生效` }
}

export function wipeAll(): void {
  const doomed: string[] = []
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i)
      if (k && k.startsWith(PREFIX)) doomed.push(k)
    }
    doomed.forEach((k) => localStorage.removeItem(k))
  } catch {
    /* ignore */
  }
}
