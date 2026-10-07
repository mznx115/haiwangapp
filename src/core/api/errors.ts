export type ApiErrorKind =
  | 'config'
  | 'network'
  | 'cors'
  | 'auth'
  | 'notfound'
  | 'ratelimit'
  | 'server'
  | 'badresponse'
  | 'aborted'
  | 'unknown'

export class ApiError extends Error {
  readonly kind: ApiErrorKind
  readonly status?: number
  readonly hint?: string

  constructor(kind: ApiErrorKind, message: string, status?: number, hint?: string) {
    super(message)
    this.name = 'ApiError'
    this.kind = kind
    this.status = status
    this.hint = hint
  }
}

export interface FriendlyError {
  title: string
  detail: string
  hint: string
}

/** 把任意异常翻译成给用户看的中文说明 + 可执行的排查建议 */
export function describeError(err: unknown): FriendlyError {
  if (err instanceof ApiError) {
    switch (err.kind) {
      case 'config':
        return {
          title: '接口未配置',
          detail: err.message,
          hint: err.hint ?? '请到「设置」里填写 Base URL 与 API Key。',
        }
      case 'cors':
        return {
          title: '请求被浏览器同源策略拦截（CORS）',
          detail: err.message,
          hint:
            err.hint ??
            '服务端没有返回 Access-Control-Allow-Origin。三种解法：① 在网关/nginx 上加该响应头（推荐）；② App 内改用非流式模式；③ 服务端开启 HTTPS。',
        }
      case 'network':
        return {
          title: '连接不上服务器',
          detail: err.message,
          hint:
            err.hint ??
            '请检查网络、Base URL 是否正确、服务是否在运行；若接口是明文 HTTP，Android 端还需要放行 cleartext。',
        }
      case 'auth':
        return {
          title: '鉴权失败',
          detail: err.message,
          hint: err.hint ?? 'API Key 无效或已过期，请到「设置」重新填写。',
        }
      case 'notfound':
        return {
          title: '接口路径不存在（404）',
          detail: err.message,
          hint:
            err.hint ??
            'Base URL 可能少了或多了 /v1。OpenAI 兼容网关的正确形式是 http://host:port/v1。',
        }
      case 'ratelimit':
        return {
          title: '请求过于频繁 / 额度不足',
          detail: err.message,
          hint: err.hint ?? '稍后再试，或检查网关里的额度与限流配置。',
        }
      case 'server':
        return {
          title: '服务端错误',
          detail: err.message,
          hint: err.hint ?? '这是网关侧的问题，请查看服务端日志。',
        }
      case 'badresponse':
        return {
          title: '返回内容格式异常',
          detail: err.message,
          hint: err.hint ?? '模型或网关没有按 OpenAI 协议返回，请确认该接口是兼容协议。',
        }
      case 'aborted':
        return {
          title: '已取消',
          detail: err.message,
          hint: '你可以重新发起一次生成。',
        }
      default:
        return { title: '请求失败', detail: err.message, hint: err.hint ?? '' }
    }
  }

  if (err instanceof DOMException && err.name === 'AbortError') {
    return { title: '已取消', detail: '生成被取消', hint: '你可以重新发起一次生成。' }
  }

  if (err instanceof Error) {
    const msg = err.message || String(err)
    if (/failed to fetch|networkerror|load failed/i.test(msg)) {
      return {
        title: '连接不上服务器（或跨域被拦截）',
        detail: msg,
        hint:
          '常见原因：① 服务端未返回 Access-Control-Allow-Origin；② Android 端拦截了明文 HTTP；③ 地址/端口写错。',
      }
    }
    return { title: '请求失败', detail: msg, hint: '' }
  }

  return { title: '请求失败', detail: String(err), hint: '' }
}

/** 把 HTTP 状态码与响应体转成 ApiError */
export async function httpError(res: Response): Promise<ApiError> {
  let detail = `${res.status} ${res.statusText}`
  try {
    const text = await res.text()
    if (text) {
      try {
        const json = JSON.parse(text) as {
          error?: { message?: string } | string
          message?: string
        }
        const e = json.error
        if (typeof e === 'string') detail = e
        else if (e?.message) detail = e.message
        else if (json.message) detail = json.message
        else detail = text.slice(0, 300)
      } catch {
        detail = text.slice(0, 300)
      }
    }
  } catch {
    /* 读不到 body 就用状态码 */
  }

  if (res.status === 401 || res.status === 403) return new ApiError('auth', detail, res.status)
  if (res.status === 404) return new ApiError('notfound', detail, res.status)
  if (res.status === 429) return new ApiError('ratelimit', detail, res.status)
  if (res.status >= 500) return new ApiError('server', detail, res.status)
  if (res.status >= 400) return new ApiError('unknown', detail, res.status)
  return new ApiError('badresponse', detail, res.status)
}
