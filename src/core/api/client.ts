import type { ApiConfig, ChatRequest, StreamHandlers } from './types'
import { ApiError, httpError } from './errors'

/**
 * OpenAI 兼容协议的极简客户端。
 *
 * 设计要点：
 * - 只依赖 /v1/models 与 /v1/chat/completions 两个标准端点
 * - 流式优先；服务端未按 SSE 返回时自动回退到一次性 JSON 解析
 * - 所有异常统一成 ApiError，UI 侧用 describeError() 翻译成中文提示
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
        '同一局域网/公网能访问该地址不代表 WebView 能跨域请求。最快的验证办法：在设置页点「测试连接」，若 /v1/models 也失败，基本可以确定是 CORS 或明文 HTTP 被拦。',
      )
    }
    throw err
  }
}

/** GET /models —— 拉取可用模型列表 */
export async function listModels(cfg: ApiConfig, signal?: AbortSignal): Promise<string[]> {
  if (!cfg.baseUrl.trim()) throw new ApiError('config', 'Base URL 为空')
  const res = await safeFetch(resolveUrl(cfg.baseUrl, '/models'), {
    method: 'GET',
    headers: authHeaders(cfg),
    signal,
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

  return data
    .map((item) => (typeof item === 'string' ? item : (item as { id?: string })?.id))
    .filter((id): id is string => typeof id === 'string' && id.length > 0)
    .sort((a, b) => a.localeCompare(b))
}

function extractContent(json: unknown): string {
  const choices = (json as { choices?: unknown }).choices
  if (!Array.isArray(choices) || choices.length === 0) {
    throw new ApiError('badresponse', '返回结构里没有 choices', undefined, JSON.stringify(json).slice(0, 200))
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

/** 解析 SSE 文本流，逐段回调增量 */
async function consumeSse(
  res: Response,
  onDelta?: (delta: string) => void,
): Promise<string> {
  const body = res.body
  if (!body) throw new ApiError('badresponse', '流式响应没有可读的 body')

  const reader = body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  let full = ''

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    // SSE 以空行分隔事件，这里按行处理即可（OpenAI 每个事件只有一行 data）
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const rawLine of lines) {
      const line = rawLine.trim()
      if (!line || line.startsWith(':')) continue
      if (!line.startsWith('data:')) continue

      const payload = line.slice(5).trim()
      if (!payload || payload === '[DONE]') continue

      try {
        const json = JSON.parse(payload) as unknown
        const delta = extractContent(json)
        if (delta) {
          full += delta
          onDelta?.(delta)
        }
      } catch {
        // 单行解析失败不致命，跳过即可
      }
    }
  }

  // 处理没有以换行结尾的残留
  const tail = buffer.trim()
  if (tail.startsWith('data:')) {
    const payload = tail.slice(5).trim()
    if (payload && payload !== '[DONE]') {
      try {
        const delta = extractContent(JSON.parse(payload))
        if (delta) {
          full += delta
          onDelta?.(delta)
        }
      } catch {
        /* ignore */
      }
    }
  }

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
    return text
  }

  if (wantStream && res.body) {
    return consumeSse(res, handlers.onDelta)
  }

  // 兜底：既不是 JSON 也不是流，尝试整段文本
  const text = await res.text()
  if (!text) throw new ApiError('badresponse', '响应内容为空')
  if (handlers.onDelta) handlers.onDelta(text)
  return text
}

export interface ConnectionTestResult {
  ok: boolean
  models: string[]
  /** 实际生效的探测方式 */
  via: 'models' | 'chat' | 'none'
  message: string
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
  try {
    const models = await listModels(cfg, signal)
    return {
      ok: true,
      models,
      via: 'models',
      message: `连接成功，网关返回 ${models.length} 个模型。`,
    }
  } catch (err) {
    const first = err
    // /models 失败但可能是网关没开这个端点，再用最小对话试一次
    if (model.trim()) {
      try {
        const text = await chat(
          cfg,
          {
            model,
            messages: [{ role: 'user', content: 'ping' }],
            max_tokens: 8,
            stream: false,
          },
          { signal },
        )
        return {
          ok: true,
          models: [],
          via: 'chat',
          message: `连接成功（通过对话接口验证），返回：${text.slice(0, 40) || '(空)'}`,
        }
      } catch {
        throw first
      }
    }
    throw first
  }
}
