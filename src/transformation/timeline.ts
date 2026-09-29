import type { SuitPartName } from '../character/rigSpec'

/** [start, end] seconds within the transformation for each suit region. Derived from spec §6 keyframes. */
export type Windows = Record<SuitPartName, [number, number]>

export const SUIT_UP_DURATION = 2.5
export const SUIT_UP_WINDOWS: Windows = {
  Chest: [0.40, 0.80], Back: [0.45, 0.88], Shoulder_L: [0.50, 0.88], Shoulder_R: [0.50, 0.88],
  Arm_L: [0.60, 1.00], Arm_R: [0.60, 1.00], Forearm_L: [0.75, 1.10], Forearm_R: [0.75, 1.10],
  Hand_L: [0.90, 1.20], Hand_R: [0.90, 1.20], Waist: [0.85, 1.25],
  Thigh_L: [1.05, 1.42], Thigh_R: [1.05, 1.42], Shin_L: [1.20, 1.58], Shin_R: [1.20, 1.58],
  Foot_L: [1.35, 1.72], Foot_R: [1.35, 1.72], Neck: [1.55, 1.85], Head: [1.78, 2.05],
}
export const SUIT_UP_KEYS = { core: 0.15, particles: 0.25, chestArmor: 0.6, upperBody: 0.75, arms: 0.9, waist: 1.05, thigh: 1.2, leg: 1.35, boot: 1.5, neck: 1.65, maskForm: 1.8, maskClose: 2.05, eyes: 2.2, emblem: 2.35, complete: 2.5 }

/** Reverse (spec §9): Mask → Neck → Arms → Chest → Legs; particles are recalled to the chest. */
export const SUIT_DOWN_DURATION = 2.15
export const SUIT_DOWN_WINDOWS: Windows = {
  Head: [0.0, 0.4], Neck: [0.3, 0.62],
  Hand_L: [0.5, 0.78], Hand_R: [0.5, 0.78], Forearm_L: [0.6, 0.92], Forearm_R: [0.6, 0.92],
  Arm_L: [0.72, 1.05], Arm_R: [0.72, 1.05], Shoulder_L: [0.82, 1.12], Shoulder_R: [0.82, 1.12],
  Chest: [0.95, 1.35], Back: [0.92, 1.3], Waist: [1.15, 1.45],
  Thigh_L: [1.3, 1.65], Thigh_R: [1.3, 1.65], Shin_L: [1.42, 1.78], Shin_R: [1.42, 1.78],
  Foot_L: [1.55, 1.9], Foot_R: [1.55, 1.9],
}
export const SUIT_DOWN_KEYS = { start: 0, recall: 0.5, chestFlash: 1.9, complete: 2.15 }

export const MASK_DURATION = 0.7
export const ARMS_DEPLOY_DURATION = 1.7
export const ARMS_RETRACT_DURATION = 1.25

export const smooth01 = (x: number) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t) }
export const window01 = (t: number, [a, b]: [number, number]) => smooth01((t - a) / (b - a))
