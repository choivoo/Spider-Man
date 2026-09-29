import { json, rateLimit } from '../server/http'

export const config = { runtime: 'nodejs', maxDuration: 30 }

/**
 * Optional server-side TTS through any OpenAI-compatible `/v1/audio/speech` endpoint
 * (set TTS_BASE_URL / TTS_API_KEY / TTS_MODEL / TTS_VOICE). The key never reaches the browser.
 * Without configuration the app uses the browser's built-in voices.
 *
 * NOTE: intentionally a *synthetic* preset voice — it never clones a real person's voice.
 */
export default async function handler(request: Request): Promise<Response> {
  const base = process.env.TTS_BASE_URL?.replace(/\/$/, '')
  const enabled = Boolean(base && process.env.TTS_MODEL)
  if (request.method === 'GET') return json({ enabled })
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  if (!enabled) return json({ error: 'tts_not_configured' }, 501)
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local'
  if (!rateLimit('tts:' + ip, 20, 60_000)) return json({ error: 'rate_limited' }, 429)
  try {
    const body = (await request.json()) as { text?: unknown; speed?: unknown }
    const text = typeof body.text === 'string' ? body.text.slice(0, 700) : ''
    if (!text.trim()) return json({ error: 'bad_request' }, 400)
    const speed = typeof body.speed === 'number' ? Math.min(1.6, Math.max(0.6, body.speed)) : 1
    const r = await fetch(`${base}/v1/audio/speech`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(process.env.TTS_API_KEY ? { authorization: `Bearer ${process.env.TTS_API_KEY}` } : {}) },
      body: JSON.stringify({ model: process.env.TTS_MODEL, voice: process.env.TTS_VOICE || 'alloy', input: text, speed, response_format: 'mp3' }),
    })
    if (!r.ok) return json({ error: 'upstream' }, 502)
    return new Response(r.body, { status: 200, headers: { 'content-type': r.headers.get('content-type') || 'audio/mpeg', 'cache-control': 'no-store' } })
  } catch {
    return json({ error: 'server_error' }, 500)
  }
}
