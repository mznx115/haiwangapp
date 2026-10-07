export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatRequest {
  model: string
  messages: ChatMessage[]
  temperature?: number
  max_tokens?: number
  stream?: boolean
}

export interface ApiConfig {
  /** 归一化后的 base url，不带尾部斜杠，通常形如 http://host:port/v1 */
  baseUrl: string
  apiKey: string
}

export interface StreamHandlers {
  /** 每收到一段增量文本回调 */
  onDelta?: (delta: string) => void
  signal?: AbortSignal
  /**
   * 实际用了哪条传输通道。
   * 浏览器 fetch 支持流式；原生 OkHttp 能绕过 CORS 但不支持流式。
   */
  onTransport?: (info: TransportInfo) => void
  /**
   * 服务端给出的结束原因。
   * 'length' 表示被 max_tokens 截断 —— 这是 JSON 解析失败最常见的原因。
   */
  onFinish?: (reason: string) => void
}

export interface TransportInfo {
  mode: 'fetch' | 'native'
  streaming: boolean
  /** 为什么切换到原生通道 */
  note?: string
}
