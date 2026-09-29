import { json, rateLimit } from '../server/http'

export const config = { runtime: 'nodejs', maxDuration: 5 }

/** Client error sink: writes one structured line to the platform log. No storage, no PII. */
export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local'
  if (!rateLimit('log:' + ip, 30, 60_000)) return json({ ok: true })
  try {
    const text = (await request.text()).slice(0, 2000)
    console.error(JSON.stringify({ source: 'client', report: JSON.parse(text) }))
  } catch { /* ignore malformed reports */ }
  return new Response(null, { status: 204 })
}
