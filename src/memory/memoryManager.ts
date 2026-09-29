import { DEFAULT_VARS, type CharacterVars, type ChatTurn, type MemoryItem, type MemoryType } from '../ai/schema'
import type { MemorySnapshot, MemoryStore } from './types'

export const MAX_ITEMS = 200
export const SUMMARIZE_AFTER_TURNS = 14
export const KEEP_RECENT_TURNS = 8

/** Things that must never be stored: keys, passwords, card numbers, tokens. */
const SENSITIVE = /(sk-[a-z0-9_-]{16,}|api[_ -]?key|password|passwd|비밀번호|비번|secret|token\b|\b\d{13,19}\b|\b\d{6}-\d{7}\b|-----BEGIN)/i
export const looksSensitive = (t: string) => SENSITIVE.test(t)

const EXPLICIT = /(기억해|잊지\s*마|remember (this|that|me)|don'?t forget|중요해|important)/i
export const isExplicitRemember = (t: string) => EXPLICIT.test(t)

let idn = 0
const newId = () => `mem_${Date.now().toString(36)}_${(idn++).toString(36)}`

/** Korean-friendly tokens: latin words + hangul bigrams. */
export function tokens(text: string): Set<string> {
  const out = new Set<string>()
  const t = text.toLowerCase()
  for (const w of t.match(/[a-z0-9]{2,}/g) ?? []) out.add(w)
  for (const run of t.match(/[가-힣]+/g) ?? []) {
    if (run.length === 1) { out.add(run); continue }
    for (let i = 0; i < run.length - 1; i++) out.add(run.slice(i, i + 2))
  }
  return out
}
const jaccard = (a: Set<string>, b: Set<string>) => {
  if (!a.size || !b.size) return 0
  let inter = 0
  for (const x of a) if (b.has(x)) inter++
  return inter / (a.size + b.size - inter)
}

const DAY = 86_400_000
/** Retention score: importance decays with age; important memories decay far slower. */
export function retention(m: MemoryItem, now: number): number {
  const age = Math.max(0, now - m.timestamp) / DAY
  const halfLife = 3 + (m.importance / 100) ** 2 * 400 // days: 20→~5d, 60→~150d, 90→~330d
  return m.importance * Math.pow(0.5, age / halfLife)
}

export interface TurnLog extends ChatTurn { ts: number }

export class MemoryManager {
  items: MemoryItem[] = []
  summary = ''
  vars: CharacterVars = { ...DEFAULT_VARS }
  turns: TurnLog[] = []
  private turnsSinceSummary = 0
  private saveTimer: ReturnType<typeof setTimeout> | null = null
  loaded = false
  onChange: (() => void) | null = null

  constructor(public store: MemoryStore) {}

  async setStore(store: MemoryStore, migrate = false) {
    const snap = this.snapshot()
    this.store = store
    if (migrate) await this.store.save(snap).catch(() => {})
    else await this.load()
  }

  async load() {
    let snap: MemorySnapshot | null = null
    try { snap = await this.store.load() } catch { snap = null }
    if (snap) {
      this.items = snap.items ?? []
      this.summary = snap.summary ?? ''
      this.vars = { ...DEFAULT_VARS, ...(snap.vars ?? {}) }
      this.turns = snap.turns ?? []
    }
    this.loaded = true
    this.prune()
    this.onChange?.()
  }

  snapshot(): MemorySnapshot {
    return { version: 1, items: this.items, summary: this.summary, vars: this.vars, turns: this.turns.slice(-40), updatedAt: Date.now() }
  }

  scheduleSave() {
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.saveTimer = setTimeout(() => { void this.store.save(this.snapshot()).catch(() => {}) }, 600)
  }
  async flush() { if (this.saveTimer) clearTimeout(this.saveTimer); await this.store.save(this.snapshot()).catch(() => {}) }

  /** add or merge a memory. Returns the stored item or null if rejected. */
  add(input: { content: string; type: MemoryType | MemoryItem['type']; importance: number; tags?: string[] }, now = Date.now()): MemoryItem | null {
    const content = input.content.trim().slice(0, 400)
    if (!content || looksSensitive(content)) return null
    const importance = Math.min(100, Math.max(0, Math.round(input.importance)))
    const tk = tokens(content)
    const dup = this.items.find((m) => jaccard(tokens(m.content), tk) > 0.7)
    if (dup) {
      dup.importance = Math.max(dup.importance, importance)
      dup.timestamp = now
      dup.tags = Array.from(new Set([...dup.tags, ...(input.tags ?? [])])).slice(0, 8)
      if (content.length > dup.content.length) dup.content = content
      this.touch()
      return dup
    }
    const item: MemoryItem = { id: newId(), type: input.type, content, importance, timestamp: now, tags: (input.tags ?? []).slice(0, 8) }
    this.items.push(item)
    this.prune(now)
    this.touch()
    return item
  }

  remove(id: string) { this.items = this.items.filter((m) => m.id !== id); this.touch() }
  async clearAll() {
    this.items = []; this.summary = ''; this.turns = []; this.vars = { ...DEFAULT_VARS }; this.turnsSinceSummary = 0
    await this.store.clear().catch(() => {})
    this.onChange?.()
  }

  /** Drop forgotten memories, cap the list. */
  prune(now = Date.now()) {
    this.items = this.items.filter((m) => m.importance >= 85 || retention(m, now) >= 4)
    if (this.items.length > MAX_ITEMS) {
      this.items.sort((a, b) => retention(b, now) - retention(a, now))
      this.items.length = MAX_ITEMS
    }
  }

  /** The memories worth putting in the prompt for this user message. */
  relevant(query: string, limit = 8, now = Date.now()): MemoryItem[] {
    const q = tokens(query)
    const scored = this.items.map((m) => {
      const overlap = jaccard(q, tokens(m.content + ' ' + m.tags.join(' ')))
      const tagHit = m.tags.some((t) => query.toLowerCase().includes(t.toLowerCase())) ? 0.25 : 0
      const base = retention(m, now) / 100
      return { m, s: overlap * 1.6 + tagHit + base * 0.6 + (m.importance >= 80 ? 0.35 : 0) }
    })
    return scored.filter((x) => x.s > 0.22).sort((a, b) => b.s - a.s).slice(0, limit).map((x) => x.m)
  }

  // ---- short-term memory
  recordTurn(role: 'user' | 'assistant', content: string) {
    // never persist anything that looks like a secret (the live conversation still saw it)
    this.turns.push({ role, content: looksSensitive(content) ? '[message withheld: looked sensitive]' : content, ts: Date.now() })
    if (role === 'assistant') this.turnsSinceSummary++
    if (this.turns.length > 60) this.turns.splice(0, this.turns.length - 60)
    this.touch()
  }
  shortTerm(n = 16): ChatTurn[] { return this.turns.slice(-n).map(({ role, content }) => ({ role, content })) }

  needsSummary() { return this.turnsSinceSummary >= SUMMARIZE_AFTER_TURNS && this.turns.length > KEEP_RECENT_TURNS + 2 }
  /** turns that will be folded into the summary (everything except the most recent few) */
  turnsToSummarize(): ChatTurn[] { return this.turns.slice(0, Math.max(0, this.turns.length - KEEP_RECENT_TURNS)).slice(-30).map(({ role, content }) => ({ role, content })) }
  applySummary(text: string) {
    if (!text.trim()) return
    this.summary = text.trim()
    this.turns = this.turns.slice(-KEEP_RECENT_TURNS)
    this.turnsSinceSummary = 0
    this.add({ content: 'Conversation summary: ' + this.summary.slice(0, 300), type: 'conversationSummary', importance: 55, tags: ['summary'] })
    this.touch()
  }

  setVars(v: CharacterVars) { this.vars = v; this.scheduleSave() }
  private touch() { this.scheduleSave(); this.onChange?.() }
}
