import type { CharacterVars, Emotion, CharacterResponse } from './schema'

const clamp = (v: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v))

/** How much Hero mode shifts the personality (spec §15): confidence +15%, alertness/reaction +30%, humor +10%. */
export const HERO_MODIFIERS = { confidence: 1.15, humor: 1.1, alertness: 1.3, reactionSpeed: 1.3 } as const

export function effectiveConfidence(vars: CharacterVars, form: 'peter' | 'spider') {
  return clamp(vars.confidence * (form === 'spider' ? HERO_MODIFIERS.confidence : 1))
}

/** Update the hidden internal variables after an exchange. Small, bounded steps — personality drifts, it doesn't jump. */
export function updateVars(
  v: CharacterVars,
  input: { userText: string; response: CharacterResponse; form: 'peter' | 'spider' },
): CharacterVars {
  const { userText, response: r, form } = input
  const n = { ...v }
  const len = Math.min(1, userText.length / 120)
  const warm = /고마|감사|좋아|재밌|최고|thanks|thank you|love|awesome|great/i.test(userText)
  const rude = /바보|멍청|짜증|꺼져|shut up|stupid|idiot/i.test(userText)
  n.conversationDepth = clamp(v.conversationDepth + 1.2 + len * 2.5)
  n.friendship = clamp(v.friendship + 0.5 + (warm ? 1.5 : 0) - (rude ? 3 : 0))
  n.trust = clamp(v.trust + 0.3 + (r.memoryCandidate && r.memoryCandidate.importance >= 40 ? 1.2 : 0) + (warm ? 0.8 : 0) - (rude ? 3 : 0))
  const e: Emotion = r.emotion, k = r.emotionIntensity
  n.stress = clamp(v.stress + (e === 'worried' || e === 'sad' ? 6 * k : e === 'serious' ? 2 * k : -1.2) - (warm ? 1.5 : 0) + (rude ? 4 : 0))
  n.curiosity = clamp(v.curiosity + (e === 'curious' || e === 'thinking' ? 3 * k : -0.4))
  n.embarrassment = clamp(v.embarrassment + (e === 'embarrassed' ? 8 * k : -2))
  n.energy = clamp(v.energy + (e === 'excited' || e === 'happy' ? 2.5 * k : -0.6) + (form === 'spider' ? 0.3 : 0))
  n.confidence = clamp(v.confidence + (e === 'confident' ? 2 * k : e === 'embarrassed' ? -1.5 * k : 0.1))
  n.heroConfidence = clamp(v.heroConfidence + (form === 'spider' ? 0.5 : 0) + (e === 'confident' ? 1 : 0))
  return n
}

/** Passive recovery toward calm baselines (call every few seconds). */
export function relaxVars(v: CharacterVars, dtSec: number): CharacterVars {
  const k = Math.min(1, dtSec / 60)
  const toward = (x: number, base: number, rate: number) => x + (base - x) * Math.min(1, rate * k)
  return {
    ...v,
    stress: toward(v.stress, 15, 0.5),
    embarrassment: toward(v.embarrassment, 10, 0.7),
    energy: toward(v.energy, 60, 0.15),
    curiosity: toward(v.curiosity, 60, 0.1),
  }
}

/** Resting mood shown when nothing is being expressed. */
export function baselineEmotion(v: CharacterVars): { emotion: Emotion; intensity: number } {
  if (v.stress > 55) return { emotion: 'worried', intensity: 0.25 }
  if (v.energy > 75 && v.friendship > 40) return { emotion: 'happy', intensity: 0.28 }
  if (v.curiosity > 75) return { emotion: 'curious', intensity: 0.22 }
  if (v.friendship > 60) return { emotion: 'happy', intensity: 0.2 }
  return { emotion: 'neutral', intensity: 0.15 }
}

/** Emotion intensity decays back toward baseline over ~20 s so faces don't freeze in an expression. */
export function decayEmotion(cur: { emotion: Emotion; intensity: number }, base: { emotion: Emotion; intensity: number }, dtSec: number) {
  const k = 1 - Math.exp(-dtSec / 14)
  const intensity = cur.intensity + (0 - cur.intensity) * k
  if (intensity < Math.max(0.12, base.intensity)) return { ...base }
  return { emotion: cur.emotion, intensity }
}
