import { handleChat, requestSchema, hasApiKey } from '../server/chatCore'
import { offlineReply } from '../src/ai/offlineBrain'
import { rateLimit, json } from '../server/http'
import type { ChatRequest } from '../src/ai/schema'

export const config = { runtime: 'nodejs', maxDuration: 60 }

export default async function handler(request: Request): Promise<Response> {
  if (request.method === 'GET') return json({ ok: true, claude: hasApiKey() })
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local'
  if (!rateLimit(ip, 40, 60_000)) return json({ error: 'rate_limited' }, 429)

  let body: unknown
  try {
    const text = await request.text()
    if (text.length > 200_000) return json({ error: 'too_large' }, 413)
    body = JSON.parse(text)
  } catch {
    return json({ error: 'bad_json' }, 400)
  }
  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) return json({ error: 'bad_request' }, 400)
  const req = parsed.data as unknown as ChatRequest
  try {
    return json(await handleChat(req))
  } catch (e) {
    console.error(JSON.stringify({ level: 'error', where: 'api/chat', message: e instanceof Error ? e.message : String(e) }))
    // Do not leak upstream details. Client shows "Connection temporarily unavailable".
    if (req.mode === 'chat' && !hasApiKey()) return json({ response: offlineReply(req), source: 'offline' })
    return json({ error: 'upstream_unavailable' }, 502)
  }
}
