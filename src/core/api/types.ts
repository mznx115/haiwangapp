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
}
