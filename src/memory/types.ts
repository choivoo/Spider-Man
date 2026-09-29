import type { CharacterVars, ChatTurn, MemoryItem } from '../ai/schema'

export interface MemorySnapshot {
  version: 1
  items: MemoryItem[]
  summary: string
  vars: CharacterVars
  /** last conversation turns kept for continuity across reloads */
  turns: (ChatTurn & { ts: number })[]
  updatedAt: number
}

/** Storage adapter — swap local / session / cloud without touching the manager. */
export interface MemoryStore {
  readonly kind: 'device' | 'session' | 'cloud'
  load(): Promise<MemorySnapshot | null>
  save(s: MemorySnapshot): Promise<void>
  clear(): Promise<void>
}
