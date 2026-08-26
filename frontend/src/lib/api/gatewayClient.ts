import { API_BASE } from './base'

// Direct client for the gateway's own bearer-token auth (a virtual key),
// distinct from the cookie-authenticated admin API in ./client.ts — this is
// what an external application (a chatbot, a script) would call.

export interface GatewayChatResult {
  status: number
  ok: boolean
  gatewayRequestId: string | null
  policyAction: string | null
  cacheStatus: string | null
  body: Record<string, unknown> | null
}

export async function sendGatewayChatCompletion(input: {
  virtualKey: string
  model: string
  messages: { role: string; content: string }[]
  stream?: boolean
}): Promise<GatewayChatResult> {
  const res = await fetch(`${API_BASE}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.virtualKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: input.model, messages: input.messages, stream: Boolean(input.stream) }),
  })

  const text = await res.text()
  const contentType = res.headers.get('content-type') ?? ''
  const body = text ? (contentType.includes('text/event-stream') ? sseToChatBody(text) : JSON.parse(text)) : null

  return {
    status: res.status,
    ok: res.ok,
    gatewayRequestId: res.headers.get('X-IndusGate-Gateway-Request-Id'),
    policyAction: res.headers.get('X-IndusGate-Policy-Action'),
    cacheStatus: res.headers.get('X-IndusGate-Cache'),
    body,
  }
}

function sseToChatBody(text: string): Record<string, unknown> {
  const chunks = text
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data: '))
    .map((line) => line.slice(6).trim())
    .filter((line) => line && line !== '[DONE]')
    .map((line) => JSON.parse(line) as Record<string, unknown>)
  const content = chunks
    .flatMap((chunk) => Array.isArray(chunk.choices) ? chunk.choices : [])
    .map((choice) => {
      const delta = (choice as { delta?: { content?: string } }).delta
      return typeof delta?.content === 'string' ? delta.content : ''
    })
    .join('')
  const last = chunks[chunks.length - 1] ?? {}
  return {
    id: last.id ?? 'streamed-response',
    object: 'chat.completion',
    model: last.model,
    choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
    stream_events: text,
  }
}
