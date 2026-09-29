import type { Viseme } from './faceTypes'

/**
 * Text → viseme timeline (Korean jamo + English graphemes). This is a phoneme-*derived* estimate — real audio
 * alignment is only available when the TTS provider reports word boundaries, which we use to re-sync (see syncToChar).
 */
export interface VisemeEvent { t: number; dur: number; viseme: Viseme; charIndex: number }

const HANGUL_BASE = 0xac00
const V_MAP: Record<number, Viseme> = {
  0: 'AA', 1: 'EE', 2: 'AA', 3: 'EE', 4: 'OH', 5: 'EE', 6: 'OH', 7: 'EE', 8: 'OH', 9: 'OH', 10: 'OH', 11: 'OH',
  12: 'OH', 13: 'OU', 14: 'OU', 15: 'OU', 16: 'OU', 17: 'OU', 18: 'IH', 19: 'IH', 20: 'EE',
}
const CHO_MAP: Record<number, Viseme> = { 6: 'M', 7: 'M', 8: 'M', 17: 'M', 5: 'L', 12: 'CH', 13: 'CH', 14: 'CH' }
const JONG_M = new Set([16, 17, 26])

interface Unit { v: Viseme; w: number; ci: number }

function unitsFor(text: string): Unit[] {
  const out: Unit[] = []
  const lower = text.toLowerCase()
  for (let i = 0; i < lower.length; i++) {
    const ch = lower[i]
    const code = ch.charCodeAt(0)
    if (code >= HANGUL_BASE && code <= 0xd7a3) {
      const s = code - HANGUL_BASE
      const jong = s % 28, jung = Math.floor((s % 588) / 28), cho = Math.floor(s / 588)
      if (CHO_MAP[cho]) out.push({ v: CHO_MAP[cho], w: 0.45, ci: i })
      out.push({ v: V_MAP[jung] ?? 'AA', w: 1, ci: i })
      if (JONG_M.has(jong)) out.push({ v: 'M', w: 0.4, ci: i })
      continue
    }
    if (/[,.;:!?…\n]/.test(ch)) { out.push({ v: 'REST', w: ch === ',' ? 0.7 : 1.2, ci: i }); continue }
    if (/\s/.test(ch)) { out.push({ v: 'REST', w: 0.25, ci: i }); continue }
    const two = lower.slice(i, i + 2)
    if (['th', 'sh', 'ch', 'zh'].includes(two)) { out.push({ v: 'CH', w: 0.6, ci: i }); i++; continue }
    if (['oo', 'ou', 'ew'].includes(two)) { out.push({ v: 'OU', w: 1, ci: i }); i++; continue }
    if (['ee', 'ea', 'ie'].includes(two)) { out.push({ v: 'EE', w: 1, ci: i }); i++; continue }
    if ('a'.includes(ch)) out.push({ v: 'AA', w: 1, ci: i })
    else if (ch === 'e') out.push({ v: 'EE', w: 0.8, ci: i })
    else if (ch === 'i' || ch === 'y') out.push({ v: 'IH', w: 0.8, ci: i })
    else if (ch === 'o') out.push({ v: 'OH', w: 1, ci: i })
    else if (ch === 'u') out.push({ v: 'OU', w: 0.9, ci: i })
    else if ('mbp'.includes(ch)) out.push({ v: 'M', w: 0.45, ci: i })
    else if ('fv'.includes(ch)) out.push({ v: 'FV', w: 0.5, ci: i })
    else if (ch === 'l' || ch === 'r') out.push({ v: 'L', w: 0.45, ci: i })
    else if ('jgxqz'.includes(ch)) out.push({ v: 'CH', w: 0.4, ci: i })
    // other consonants: coarticulate (no unit)
  }
  return out
}

/** rough speaking time in seconds at rate 1.0 */
export function estimateDuration(text: string, rate = 1): number {
  const u = unitsFor(text)
  const total = u.reduce((s, x) => s + x.w, 0)
  return Math.max(0.6, (total * 0.105) / rate)
}

export function buildTimeline(text: string, duration?: number): VisemeEvent[] {
  const u = unitsFor(text)
  const total = u.reduce((s, x) => s + x.w, 0) || 1
  const D = duration ?? estimateDuration(text)
  let t = 0
  return u.map((x) => {
    const dur = (x.w / total) * D
    const e = { t, dur, viseme: x.v, charIndex: x.ci }
    t += dur
    return e
  })
}

/** Plays a timeline; can be re-synced by character index (from TTS boundary events). */
export class LipSyncPlayer {
  private tl: VisemeEvent[] = []
  private time = 0
  private total = 0
  playing = false
  amplitude = 0.7

  start(text: string, duration?: number) {
    this.tl = buildTimeline(text, duration)
    this.total = this.tl.length ? this.tl[this.tl.length - 1].t + this.tl[this.tl.length - 1].dur : 0
    this.time = 0
    this.playing = this.tl.length > 0
  }
  stop() { this.playing = false; this.tl = [] }
  get progress() { return this.total ? this.time / this.total : 0 }
  syncToChar(charIndex: number) {
    const ev = this.tl.find((e) => e.charIndex >= charIndex)
    if (ev && Math.abs(ev.t - this.time) > 0.08) this.time = ev.t
  }
  /** Stretch remaining timeline so it ends at `remainingSec` (used when real audio duration becomes known). */
  fitTo(totalSec: number) {
    if (!this.total || totalSec <= 0) return
    const k = totalSec / this.total
    this.tl = this.tl.map((e) => ({ ...e, t: e.t * k, dur: e.dur * k }))
    this.total = totalSec
  }
  tick(dt: number): { viseme: Viseme; weight: number } | null {
    if (!this.playing) return null
    this.time += dt
    if (this.time >= this.total) { this.playing = false; return { viseme: 'REST', weight: 1 } }
    let cur = this.tl[0]
    for (const e of this.tl) { if (e.t <= this.time) cur = e; else break }
    const local = (this.time - cur.t) / Math.max(1e-3, cur.dur)
    // quick attack, gentle release → readable articulation
    const env = cur.viseme === 'REST' ? 1 : Math.min(1, local * 5) * (1 - Math.max(0, local - 0.7) * 0.9)
    return { viseme: cur.viseme, weight: cur.viseme === 'REST' ? 1 : env * this.amplitude }
  }
}
