import * as THREE from 'three'
import type { ArmsMode } from '../transformation/NanotechController'

/**
 * Per-mode targets in CHEST space (+X = character's left, +Y up, +Z forward, −Z back).
 * Order: [topL, topR, botL, botR]. `wrist` = where the claw base goes, `claw` = claw direction, `pole` = elbow bend hint.
 */
export interface ArmGoal { wrist: THREE.Vector3; claw: THREE.Vector3; curl: THREE.Vector3; pole: THREE.Vector3 }
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)

const mirror = (g: ArmGoal): ArmGoal => ({
  wrist: v(-g.wrist.x, g.wrist.y, g.wrist.z), claw: v(-g.claw.x, g.claw.y, g.claw.z),
  curl: v(-g.curl.x, g.curl.y, g.curl.z), pole: v(-g.pole.x, g.pole.y, g.pole.z),
})
const pair = (l: ArmGoal): [ArmGoal, ArmGoal] => [l, mirror(l)]

/** x, y, z target of the wrist; claw direction; curl direction; pole */
const TOP = {
  IDLE: { wrist: v(0.44, 0.56, -0.12), claw: v(0.25, -0.55, 0.8), curl: v(-0.6, -0.2, 0.3), pole: v(0.5, 1, -0.5) },
  DEFENSE: { wrist: v(0.06, 0.3, 0.5), claw: v(-0.35, 0.7, 0.6), curl: v(-1, 0, 0), pole: v(0.9, 0.7, 0.2) },
  ATTACK: { wrist: v(0.2, 0.3, 0.82), claw: v(0.05, -0.15, 1), curl: v(-0.7, 0.4, 0), pole: v(0.8, 1, 0) },
  BALANCE: { wrist: v(0.7, 0.35, -0.05), claw: v(0.5, -0.6, 0.4), curl: v(-0.5, 0, 0.5), pole: v(0.4, 1, -0.4) },
  POSE: { wrist: v(0.62, 0.9, -0.1), claw: v(0.5, 0.5, 0.7), curl: v(-0.6, 0.2, 0.3), pole: v(0.7, 1, -0.3) },
}
const BOT = {
  IDLE: { wrist: v(0.56, -0.42, -0.12), claw: v(0.1, -0.65, 0.75), curl: v(-0.7, 0, 0.3), pole: v(1, -0.2, -0.6) },
  DEFENSE: { wrist: v(0.16, -0.22, 0.5), claw: v(-0.4, 0.4, 0.8), curl: v(-1, 0, 0), pole: v(0.9, -0.5, 0.1) },
  ATTACK: { wrist: v(0.62, -0.5, -0.32), claw: v(0.3, -0.3, -0.9), curl: v(-0.4, 0.4, 0), pole: v(1, -0.3, -0.4) },
  BALANCE: { wrist: v(0.6, -0.98, 0.16), claw: v(0.1, -1, 0.15), curl: v(-0.8, 0, 0.4), pole: v(1, 0.1, -0.2) },
  POSE: { wrist: v(0.78, -0.55, -0.05), claw: v(0.7, -0.5, 0.5), curl: v(-0.6, 0, 0.4), pole: v(1, -0.1, -0.4) },
}

export function goalsFor(mode: ArmsMode): [ArmGoal, ArmGoal, ArmGoal, ArmGoal] {
  const m = mode === 'IDLE' ? 'IDLE' : mode
  const [tl, tr] = pair(TOP[m])
  const [bl, br] = pair(BOT[m])
  return [tl, tr, bl, br]
}

/** Folded (stowed against the back) directions for the Z-fold: [seg1, seg2, claw] — pointing along the spine. */
export const FOLD = {
  top: [v(0.06, 1, -0.05), v(-0.06, -1, -0.02), v(0.05, 1, -0.02)] as const,
  bottom: [v(0.06, -1, -0.05), v(-0.06, 1, -0.02), v(0.05, -1, -0.02)] as const,
}

/** Sockets on the back plate in chest space: [topL, topR, botL, botR]. */
export const SOCKETS: THREE.Vector3[] = [v(0.085, 0.155, -0.15), v(-0.085, 0.155, -0.15), v(0.085, 0.045, -0.15), v(-0.085, 0.045, -0.15)]
