import type { BoneName } from '../character/rigSpec'

export type V3 = [number, number, number]
export type Pose = Partial<Record<BoneName, V3>>

export interface Keyframe { t: number; pose: Pose }
/** Gesture: keyframes over `duration` seconds. Bones absent from a key are not influenced at that key, so the first/last (empty) keys fade in/out. */
export interface Gesture { duration: number; keys: Keyframe[]; /** extra oscillation added on top: (t seconds) => Pose deltas */ osc?: (t: number) => Pose }

export const smooth = (x: number) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t) }
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/** Sample a gesture at time t → { absolute value, weight } per bone. */
export function sampleGesture(g: Gesture, t: number): Partial<Record<BoneName, { v: V3; w: number }>> {
  const out: Partial<Record<BoneName, { v: V3; w: number }>> = {}
  const bones = new Set<BoneName>()
  for (const k of g.keys) for (const b of Object.keys(k.pose) as BoneName[]) bones.add(b)
  const keys = g.keys
  let i = 0
  while (i < keys.length - 2 && t > keys[i + 1].t) i++
  const k0 = keys[i], k1 = keys[Math.min(i + 1, keys.length - 1)]
  const span = Math.max(1e-4, k1.t - k0.t)
  const u = smooth(clamp((t - k0.t) / span, 0, 1))
  for (const b of bones) {
    const a = k0.pose[b], c = k1.pose[b]
    if (!a && !c) continue
    const va = a ?? c!, vc = c ?? a!
    out[b] = {
      v: [lerp(va[0], vc[0], u), lerp(va[1], vc[1], u), lerp(va[2], vc[2], u)],
      w: lerp(a ? 1 : 0, c ? 1 : 0, u),
    }
  }
  if (g.osc) {
    const d = g.osc(t)
    for (const b of Object.keys(d) as BoneName[]) {
      const e = out[b]
      if (e) e.v = [e.v[0] + d[b]![0], e.v[1] + d[b]![1], e.v[2] + d[b]![2]]
    }
  }
  return out
}
