import type { MemorySnapshot, MemoryStore } from './types'

const KEY = 'spider-ai:memory:v1'
const UID_KEY = 'spider-ai:uid'

/** Persists on this device. Contains conversation facts only — never credentials (see looksSensitive). */
export class LocalMemoryStore implements MemoryStore {
  readonly kind = 'device' as const
  async load() {
    try {
      const raw = localStorage.getItem(KEY)
      if (!raw) return null
      const s = JSON.parse(raw) as MemorySnapshot
      return s.version === 1 ? s : null
    } catch { return null }
  }
  async save(s: MemorySnapshot) { try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* quota / private mode */ } }
  async clear() { try { localStorage.removeItem(KEY) } catch { /* ignore */ } }
}

/** In-memory only; gone when the tab closes. */
export class SessionMemoryStore implements MemoryStore {
  readonly kind = 'session' as const
  private snap: MemorySnapshot | null = null
  async load() { return this.snap }
  async save(s: MemorySnapshot) { this.snap = s }
  async clear() { this.snap = null }
}

function deviceId(): string {
  try {
    let id = localStorage.getItem(UID_KEY)
    if (!id) {
      const b = crypto.getRandomValues(new Uint8Array(16))
      id = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
      localStorage.setItem(UID_KEY, id)
    }
    return id
  } catch { return 'anonymous' }
}

/** Server-backed memory via /api/memory (Supabase). The random device id acts as a bearer secret. */
export class CloudMemoryStore implements MemoryStore {
  readonly kind = 'cloud' as const
  private uid = deviceId()
  async load() {
    const r = await fetch(`/api/memory?uid=${this.uid}`)
    if (r.status === 404 || r.status === 204) return null
    if (!r.ok) throw new Error(`memory load ${r.status}`)
    const j = await r.json() as { snapshot: MemorySnapshot | null }
    return j.snapshot
  }
  async save(s: MemorySnapshot) {
    const r = await fetch('/api/memory', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ uid: this.uid, snapshot: s }) })
    if (!r.ok) throw new Error(`memory save ${r.status}`)
  }
  async clear() { await fetch(`/api/memory?uid=${this.uid}`, { method: 'DELETE' }) }
}
