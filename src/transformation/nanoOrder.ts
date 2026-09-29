import { restWorldPos, type BoneName, type SuitPartName } from '../character/rigSpec'

const c01 = (v: number) => Math.min(1, Math.max(0, v))

/**
 * Per-vertex reveal order for each suit region (0 = appears first, 1 = last). Computed in *rest-pose world
 * space* so a civilian mesh and its suit counterpart — even when attached to different bones — dissolve/form
 * along exactly the same front. Returns [primary order, secondary order] (see uMix in the shader).
 */
export function nanoOrder(part: SuitPartName, bone: BoneName): (x: number, y: number, z: number) => [number, number] {
  const [bx, by, bz] = restWorldPos(bone)
  const CORE = [0, 1.33, 0.11]
  return (lx, ly, lz) => {
    const x = lx + bx, y = ly + by, z = lz + bz
    switch (part) {
      case 'Chest': case 'Back': {
        const d = Math.hypot(x - CORE[0], (y - CORE[1]) * 0.9, (z - CORE[2]) * 0.8) / 0.34
        const n = c01(d + (part === 'Back' ? 0.12 : 0))
        return [n, n]
      }
      case 'Shoulder_L': case 'Shoulder_R': { const n = c01((Math.abs(x) - 0.05) / 0.2); return [n, n] }
      case 'Arm_L': case 'Arm_R': { const n = c01((1.44 - y) / 0.33); return [n, n] }
      case 'Forearm_L': case 'Forearm_R': { const n = c01((1.15 - y) / 0.28); return [n, n] }
      case 'Hand_L': case 'Hand_R': { const n = c01((0.89 - y) / 0.2); return [n, n] }
      case 'Waist': { const n = c01((1.2 - y) / 0.36); return [n, n] }
      case 'Thigh_L': case 'Thigh_R': { const n = c01((0.98 - y) / 0.52); return [n, n] }
      case 'Shin_L': case 'Shin_R': { const n = c01((0.52 - y) / 0.46); return [n, n] }
      case 'Foot_L': case 'Foot_R': { const n = c01(0.3 * (0.17 - y) / 0.17 + 0.7 * c01((z + 0.07) / 0.3)); return [n, n] }
      case 'Neck': { const n = c01((y - 1.4) / 0.18); return [n, n] }
      case 'Head': {
        // [0] jaw→forehead (chin = highest order, so it is removed first when opening)
        // [1] sides→centre (forms from the sides of the face, closes in the middle)
        const vert = c01(1 - (y - 1.545) / 0.235)
        const side = c01(1 - Math.abs(x) / 0.085)
        return [vert, c01(side * 0.85 + (1 - vert) * 0.15)]
      }
    }
  }
}
