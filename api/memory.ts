import { json, rateLimit } from '../server/http'

export const config = { runtime: 'nodejs', maxDuration: 15 }

/**
 * Optional cloud memory backed by Supabase (PostgREST) using the SERVICE key — which never leaves the server.
 * Table (see docs/MEMORY.md): spider_memory(uid text primary key, snapshot jsonb, updated_at timestamptz).
 * The random per-device `uid` acts as a bearer secret; do not expose it.
 */
const base = () => process.env.SUPABASE_URL?.replace(/\/$/, '')
const key = () => process.env.SUPABASE_SERVICE_KEY
const hdr = () => ({ apikey: key()!, authorization: `Bearer ${key()}`, 'content-type': 'application/json' })
const validUid = (u: unknown): u is string => typeof u === 'string' && /^[a-f0-9]{32}$/.test(u)

export default async function handler(request: Request): Promise<Response> {
  if (!base() || !key()) return json({ error: 'cloud_memory_not_configured' }, 501)
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local'
  if (!rateLimit('mem:' + ip, 60, 60_000)) return json({ error: 'rate_limited' }, 429)
  const url = new URL(request.url)
  try {
    if (request.method === 'GET') {
      const uid = url.searchParams.get('uid')
      if (!validUid(uid)) return json({ error: 'bad_uid' }, 400)
      const r = await fetch(`${base()}/rest/v1/spider_memory?uid=eq.${uid}&select=snapshot`, { headers: hdr() })
      if (!r.ok) return json({ error: 'upstream' }, 502)
      const rows = (await r.json()) as { snapshot: unknown }[]
      return json({ snapshot: rows[0]?.snapshot ?? null })
    }
    if (request.method === 'PUT') {
      const text = await request.text()
      if (text.length > 400_000) return json({ error: 'too_large' }, 413)
      const body = JSON.parse(text) as { uid?: unknown; snapshot?: unknown }
      if (!validUid(body.uid) || typeof body.snapshot !== 'object' || !body.snapshot) return json({ error: 'bad_request' }, 400)
      const r = await fetch(`${base()}/rest/v1/spider_memory?on_conflict=uid`, {
        method: 'POST',
        headers: { ...hdr(), prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({ uid: body.uid, snapshot: body.snapshot, updated_at: new Date().toISOString() }),
      })
      return r.ok ? json({ ok: true }) : json({ error: 'upstream' }, 502)
    }
    if (request.method === 'DELETE') {
      const uid = url.searchParams.get('uid')
      if (!validUid(uid)) return json({ error: 'bad_uid' }, 400)
      const r = await fetch(`${base()}/rest/v1/spider_memory?uid=eq.${uid}`, { method: 'DELETE', headers: hdr() })
      return r.ok ? json({ ok: true }) : json({ error: 'upstream' }, 502)
    }
    return json({ error: 'method_not_allowed' }, 405)
  } catch {
    return json({ error: 'server_error' }, 500)
  }
}
