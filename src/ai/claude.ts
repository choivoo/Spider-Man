import type { ChatRequest, ChatResponse } from './schema'

export class ChatError extends Error {
  constructor(public kind: 'network' | 'rate_limited' | 'server' | 'timeout', message?: string) {
    super(message ?? kind)
  }
}

/** Talks to our own serverless backend — the browser never sees an API key. */
export async function sendChat(req: ChatRequest, signal?: AbortSignal): Promise<ChatResponse> {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), 45_000)
  signal?.addEventListener('abort', () => ctl.abort())
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(req),
      signal: ctl.signal,
    })
    if (res.status === 429) throw new ChatError('rate_limited')
    if (!res.ok) throw new ChatError('server', `HTTP ${res.status}`)
    return (await res.json()) as ChatResponse
  } catch (e) {
    if (e instanceof ChatError) throw e
    if (e instanceof DOMException && e.name === 'AbortError') throw new ChatError('timeout')
    throw new ChatError('network')
  } finally {
    clearTimeout(timer)
  }
}

/** Startup probe: is the backend up, and does it have a Claude key (or is it running the offline demo brain)? */
export async function probeBackend(): Promise<'ok' | 'offline-demo' | 'unavailable'> {
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 6000)
    const r = await fetch('/api/chat', { signal: ctl.signal }); clearTimeout(t)
    if (!r.ok) return 'unavailable'
    const j = (await r.json()) as { claude?: boolean }
    return j.claude ? 'ok' : 'offline-demo'
  } catch { return 'unavailable' }
}
