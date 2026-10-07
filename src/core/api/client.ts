import { Capacitor, CapacitorHttp } from '@capacitor/core'
import type { ApiConfig, ChatRequest, StreamHandlers, TransportInfo } from './types'
import { ApiError, httpError } from './errors'

/**
 * OpenAI 兼容协议的极简客户端。
 *
 * 两条传输通道：
 *   1. 浏览器 fetch —— 支持 SSE 流式，但受同源策略约束（需要服务端给 CORS 头）
 *   2. 原生 OkHttp（CapacitorHttp）—— 绕过 CORS 与明文限制，但不支持流式
 *
 * 默认「自动」：先走 fetch；如果被 CORS/网络层拦下，且当前在原生平台，
 * 就自动改走原生通道重试一次（退化成非流式），而不是直接把错误甩给用户。
 * 这样无论你的网关有没有配 CORS，App 都能用。
 */

export function resolveUrl(baseUrl: string, path: string): string {
  const base = baseUrl.trim().replace(/\/+$/, '')
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

function authHeaders(cfg: ApiConfig): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${cfg.apiKey.trim()}`,
  }
}

/** 判断某个异常是否属于「换条通道就能救」的类型 */
function isTransportFailure(err: unknown): boolean {
  if (err instanceof ApiError) return err.kind === 'cors' || err.kind === 'network'
  if (err instanceof Error) {
    return /failed to fetch|networkerror|load failed/i.test(err.message)
  }
  return false
}

function canUseNative(): boolean {
  try {
    return Capacitor.isNativePlatform()
  } catch {
    return false
  }
}

/**
 * 统一包装 fetch：把网络层异常（含 CORS）识别出来。
 * 浏览器出于安全考虑不会告诉我们到底是 CORS 还是断网，
 * 只能通过 TypeError 结合上下文给出最可能的解释。
 */
async function safeFetch(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init)
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiError('aborted', '用户取消了请求')
    }
    if (err instanceof Error && /failed to fetch|networkerror|load failed/i.test(err.message)) {
      throw new ApiError(
        'cors',
        '无法建立连接：可能是服务端缺少 CORS 响应头，或网络/地址不可达。',
        undefined,
        '同一网络下能用浏览器打开该地址，不代表 WebView 能跨域请求。',
      )
    }
    throw err
  }
}

function extractContent(json: unknown): string {
  const choices = (json as { choices?: unknown }).choices
  if (!Array.isArray(choices) || choices.length === 0) {
    throw new ApiError(
      'badresponse',
      '返回结构里没有 choices',
      undefined,
      JSON.stringify(json).slice(0, 200),
    )
  }
  const first = choices[0] as {
    message?: { content?: unknown }
    delta?: { content?: unknown }
    text?: unknown
  }
  const content = first?.message?.content ?? first?.delta?.content ?? first?.text ?? ''
  if (typeof content === 'string') return content
  // 部分模型返回 content 数组（多模态）
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part === 'string' ? part : ((part as { text?: string })?.text ?? '')))
      .join('')
  }
  return ''
}

/* ------------------------------------------------------------------ */
/* 原生通道（CapacitorHttp / OkHttp）                                    */
/* ------------------------------------------------------------------ */

function nativeErrorFromResponse(status: number, data: unknown): ApiError {
  let detail = `HTTP ${status}`
  const obj = data as { error?: { message?: string } | string; message?: string } | null
  if (obj) {
    const e = obj.error
    if (typeof e === 'string') detail = e
    else if (e?.message) detail = e.message
    else if (obj.message) detail = obj.message
    else detail = JSON.stringify(data).slice(0, 300)
  }
  if (status === 401 || status === 403) return new ApiError('auth', detail, status)
  if (status === 404) return new ApiError('notfound', detail, status)
  if (status === 429) return new ApiError('ratelimit', detail, status)
  if (status >= 500) return new ApiError('server', detail, status)
  return new ApiError('unknown', detail, status)
}

async function nativeRequest(
  cfg: ApiConfig,
  path: string,
  method: 'GET' | 'POST',
  body?: unknown,
): Promise<unknown> {
  let res: { status: number; data: unknown }
  try {
    res = await CapacitorHttp.request({
      url: resolveUrl(cfg.baseUrl, path),
      method,
      headers: authHeaders(cfg),
      data: body,
      connectTimeout: 30_000,
      readTimeout: 180_000,
    })
  } catch (err) {
    throw new ApiError(
      'network',
      `原生请求失败：${err instanceof Error ? err.message : String(err)}`,
      undefined,
      '请检查地址、端口与网络连通性。',
    )
  }

  if (res.status >= 400) throw nativeErrorFromResponse(res.status, res.data)

  // OkHttp 会在 content-type 为 json 时自动解析；否则返回字符串
  if (typeof res.data === 'string') {
    try {
      return JSON.parse(res.data) as unknown
    } catch {
      throw new ApiError('badresponse', '响应不是合法 JSON', undefined, res.data.slice(0, 200))
    }
  }
  return res.data
}

async function nativeChat(cfg: ApiConfig, req: ChatRequest): Promise<string> {
  const json = await nativeRequest(cfg, '/chat/completions', 'POST', { ...req, stream: false })
  return extractContent(json)
}

async function nativeListModels(cfg: ApiConfig): Promise<string[]> {
  const json = await nativeRequest(cfg, '/models', 'GET')
  const data = (json as { data?: unknown }).data
  if (!Array.isArray(data)) {
    throw new ApiError('badresponse', '/v1/models 返回结构里没有 data 数组')
  }
  return data
    .map((item) => (typeof item === 'string' ? item : (item as { id?: string })?.id))
    .filter((id): id is string => typeof id === 'string' && id.length > 0)
    .sort((a, b) => a.localeCompare(b))
}

/* ------------------------------------------------------------------ */
/* 对外接口                                                            */
/* ------------------------------------------------------------------ */

export async function listModels(
  cfg: ApiConfig,
  handlers: Pick<StreamHandlers, 'signal' | 'onTransport'> = {},
): Promise<string[]> {
  if (!cfg.baseUrl.trim()) throw new ApiError('config', 'Base URL 为空')

  try {
    const res = await safeFetch(resolveUrl(cfg.baseUrl, '/models'), {
      method: 'GET',
      headers: authHeaders(cfg),
      signal: handlers.signal,
    })
    if (!res.ok) throw await httpError(res)

    let json: unknown
    try {
      json = await res.json()
    } catch {
      throw new ApiError('badresponse', '/v1/models 返回的不是合法 JSON')
    }

    const data = (json as { data?: unknown }).data
    if (!Array.isArray(data)) {
      throw new ApiError('badresponse', '/v1/models 返回结构里没有 data 数组')
    }

    handlers.onTransport?.({ mode: 'fetch', streaming: false })
    return data
      .map((item) => (typeof item === 'string' ? item : (item as { id?: string })?.id))
      .filter((id): id is string => typeof id === 'string' && id.length > 0)
      .sort((a, b) => a.localeCompare(b))
  } catch (err) {
    if (!canUseNative() || !isTransportFailure(err)) throw err
    const models = await nativeListModels(cfg)
    handlers.onTransport?.({
      mode: 'native',
      streaming: false,
      note: '浏览器请求被拦截，已自动改用系统原生请求（OkHttp）',
    })
    return models
  }
}

/** 解析 SSE 文本流，逐段回调增量 */
async function consumeSse(res: Response, onDelta?: (delta: string) => void): Promise<string> {
  const body = res.body
  if (!body) throw new ApiError('badresponse', '流式响应没有可读的 body')

  const reader = body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  let full = ''

  const handleLine = (rawLine: string) => {
    const line = rawLine.trim()
    if (!line || line.startsWith(':')) return
    if (!line.startsWith('data:')) return
    const payload = line.slice(5).trim()
    if (!payload || payload === '[DONE]') return
    try {
      const delta = extractContent(JSON.parse(payload) as unknown)
      if (delta) {
        full += delta
        onDelta?.(delta)
      }
    } catch {
      // 单行解析失败不致命
    }
  }

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) handleLine(line)
  }
  if (buffer.trim()) handleLine(buffer)

  return full
}

/**
 * POST /chat/completions
 *
 * 返回完整文本。若 onDelta 存在且服务端确实按 SSE 返回，则边收边回调。
 */
export async function chat(
  cfg: ApiConfig,
  req: ChatRequest,
  handlers: StreamHandlers = {},
): Promise<string> {
  if (!cfg.baseUrl.trim()) throw new ApiError('config', 'Base URL 为空')
  if (!cfg.apiKey.trim()) {
    throw new ApiError('config', 'API Key 为空', undefined, '请到「设置」里填写 API Key。')
  }
  if (!req.model.trim()) {
    throw new ApiError('config', '模型名为空', undefined, '请到「设置」里选择或填写模型名。')
  }

  const wantStream = req.stream !== false && typeof handlers.onDelta === 'function'

  try {
    const res = await safeFetch(resolveUrl(cfg.baseUrl, '/chat/completions'), {
      method: 'POST',
      headers: authHeaders(cfg),
      body: JSON.stringify({ ...req, stream: wantStream }),
      signal: handlers.signal,
    })

    if (!res.ok) throw await httpError(res)

    const contentType = res.headers.get('content-type') ?? ''

    // 服务端无视 stream:true 也会返回 application/json，这里自动兼容
    if (contentType.includes('application/json')) {
      const json = (await res.json()) as unknown
      const text = extractContent(json)
      if (text && handlers.onDelta) handlers.onDelta(text)
      handlers.onTransport?.({ mode: 'fetch', streaming: false })
      return text
    }

    if (wantStream && res.body) {
      handlers.onTransport?.({ mode: 'fetch', streaming: true })
      return await consumeSse(res, handlers.onDelta)
    }

    const text = await res.text()
    if (!text) throw new ApiError('badresponse', '响应内容为空')
    if (handlers.onDelta) handlers.onDelta(text)
    handlers.onTransport?.({ mode: 'fetch', streaming: false })
    return text
  } catch (err) {
    // 换原生通道重试：只在「确实是传输层被拦」且当前跑在原生平台上才做
    if (!canUseNative() || !isTransportFailure(err) || err instanceof ApiError && err.kind === 'aborted') {
      throw err
    }
    const text = await nativeChat(cfg, req)
    handlers.onTransport?.({
      mode: 'native',
      streaming: false,
      note: '浏览器请求被跨域/网络策略拦截，已自动改用系统原生请求（OkHttp）重试成功，本次为非流式输出。',
    })
    if (text && handlers.onDelta) handlers.onDelta(text)
    return text
  }
}

export interface ConnectionTestResult {
  ok: boolean
  models: string[]
  /** 实际生效的探测方式 */
  via: 'models' | 'chat'
  message: string
  transport?: TransportInfo
}

/**
 * 设置页的「测试连接」。
 * 优先探测 /v1/models；若该端点不可用（有些网关会关掉），退回一次最小对话请求。
 */
export async function testConnection(
  cfg: ApiConfig,
  model: string,
  signal?: AbortSignal,
): Promise<ConnectionTestResult> {
  const transports: TransportInfo[] = []
  const collect = (info: TransportInfo) => transports.push(info)

  try {
    const models = await listModels(cfg, { signal, onTransport: collect })
    return {
      ok: true,
      models,
      via: 'models',
      message: `连接成功，网关返回 ${models.length} 个模型。`,
      transport: transports[transports.length - 1],
    }
  } catch (err) {
    const first = err
    if (model.trim()) {
      try {
        const text = await chat(
          cfg,
          { model, messages: [{ role: 'user', content: 'ping' }], max_tokens: 8, stream: false },
          { signal, onTransport: collect },
        )
        return {
          ok: true,
          models: [],
          via: 'chat',
          message: `连接成功（通过对话接口验证），返回：${text.slice(0, 40) || '(空)'}`,
          transport: transports[transports.length - 1],
        }
      } catch {
        throw first
      }
    }
    throw first
  }
}
