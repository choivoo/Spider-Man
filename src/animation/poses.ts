import type { Gesture, Pose } from './pose'
import type { Gesture as GestureName } from '../ai/schema'

/** Euler offsets (radians) added to the rest pose. Forward swing = −X; L-arm abduction = +Z, R-arm abduction = −Z. */

export const STANCE_CIVILIAN: Pose = {
  spine: [0.02, 0, 0], chest: [0.01, 0, 0], head: [0.02, 0, 0],
  clavicleL: [0, 0, -0.03], clavicleR: [0, 0, 0.03],
  thighL: [0, 0, 0.03], thighR: [0, 0, -0.03],
}

/** Athletic ready stance for Spider mode: knees soft, feet wider, shoulders forward. */
export const STANCE_SPIDER: Pose = {
  hips: [0.06, 0, 0], spine: [0.07, 0, 0], chest: [0.05, 0, 0], head: [-0.03, 0, 0],
  clavicleL: [0, 0, -0.05], clavicleR: [0, 0, 0.05],
  upperArmL: [-0.1, 0, 0.14], upperArmR: [-0.1, 0, -0.14],
  foreArmL: [-0.35, 0, 0], foreArmR: [-0.35, 0, 0],
  thighL: [-0.16, 0, 0.1], thighR: [-0.16, 0, -0.1],
  shinL: [0.28, 0, 0], shinR: [0.28, 0, 0],
  footL: [-0.12, 0, 0], footR: [-0.12, 0, 0],
}

export const HOLD_POSES: Record<string, Pose> = {
  hands_in_pocket: {
    upperArmL: [0.0, 0, -0.1], upperArmR: [0.0, 0, 0.1],
    foreArmL: [-0.12, 0, -0.25], foreArmR: [-0.12, 0, 0.25],
    handL: [-0.05, 0, -0.1], handR: [-0.05, 0, 0.1],
    clavicleL: [0, 0, -0.04], clavicleR: [0, 0, 0.04],
  },
  cross_arms: {
    upperArmL: [-0.55, 0, -0.05], upperArmR: [-0.55, 0, 0.05],
    foreArmL: [-0.12, 0, -1.5], foreArmR: [0.05, 0, 1.5],
    handL: [0, 0, 0.1], handR: [0, 0, -0.1],
    chest: [0.03, 0, 0], head: [0.02, 0, 0],
  },
}

/** Low, wide stance while the bottom spider arms plant on the ground (BALANCE mode). */
export const POSE_CROUCH: Pose = {
  hips: [0.18, 0, 0], spine: [0.18, 0, 0], chest: [0.08, 0, 0], head: [-0.2, 0, 0],
  thighL: [-0.72, 0, 0.3], thighR: [-0.72, 0, -0.3], shinL: [1.2, 0, 0], shinR: [1.2, 0, 0], footL: [-0.45, 0, 0], footR: [-0.45, 0, 0],
}

/** Not selectable by the AI (triggered by effects). */
export const EXTRA_GESTURES: Record<string, Gesture> = {
  web_shoot: {
    duration: 1.1,
    keys: [
      { t: 0, pose: {} },
      { t: 0.14, pose: { upperArmR: [-1.25, 0, -0.1], foreArmR: [-0.15, 0, 0], handR: [0.5, 0, 0], spine: [0.04, -0.12, 0], head: [-0.05, -0.1, 0], chest: [0, -0.18, 0] } },
      { t: 0.75, pose: { upperArmR: [-1.25, 0, -0.1], foreArmR: [-0.15, 0, 0], handR: [0.5, 0, 0], spine: [0.04, -0.12, 0], head: [-0.05, -0.1, 0], chest: [0, -0.18, 0] } },
      { t: 1.1, pose: {} },
    ],
  },
  spider_sense: {
    duration: 1.0,
    keys: [
      { t: 0, pose: {} },
      { t: 0.12, pose: { head: [-0.12, 0.2, 0], chest: [-0.06, 0, 0], clavicleL: [0, 0, 0.14], clavicleR: [0, 0, -0.14], upperArmL: [-0.2, 0, 0.35], upperArmR: [-0.2, 0, -0.35], foreArmL: [-0.7, 0, 0], foreArmR: [-0.7, 0, 0] } },
      { t: 0.7, pose: { head: [-0.02, -0.2, 0], chest: [-0.04, 0, 0], upperArmL: [-0.2, 0, 0.3], upperArmR: [-0.2, 0, -0.3], foreArmL: [-0.7, 0, 0], foreArmR: [-0.7, 0, 0] } },
      { t: 1.0, pose: {} },
    ],
  },
}
const swayOsc = (f: number, a: number) => (t: number) => Math.sin(t * f) * a

export const GESTURES: Record<Exclude<GestureName, 'none' | 'cross_arms' | 'hands_in_pocket'>, Gesture> = {
  nod: {
    duration: 0.9,
    keys: [
      { t: 0, pose: {} }, { t: 0.18, pose: { head: [0.28, 0, 0], neck: [0.1, 0, 0] } },
      { t: 0.4, pose: { head: [-0.04, 0, 0], neck: [0, 0, 0] } }, { t: 0.62, pose: { head: [0.2, 0, 0], neck: [0.06, 0, 0] } },
      { t: 0.9, pose: {} },
    ],
  },
  shake_head: {
    duration: 1.1,
    keys: [{ t: 0, pose: {} }, { t: 0.15, pose: { head: [0, 0, 0] } }, { t: 0.95, pose: { head: [0, 0, 0] } }, { t: 1.1, pose: {} }],
    osc: (t) => ({ head: [0, Math.sin(t * 13) * 0.32 * Math.min(1, t * 6) * Math.max(0, 1 - Math.max(0, t - 0.8) * 5), 0] }),
  },
  wave: {
    duration: 1.9,
    keys: [
      { t: 0, pose: {} },
      { t: 0.4, pose: { upperArmR: [-0.25, 0, -1.35], foreArmR: [0, 0, -1.4], clavicleR: [0, 0, 0.1] } },
      { t: 1.5, pose: { upperArmR: [-0.25, 0, -1.35], foreArmR: [0, 0, -1.4], clavicleR: [0, 0, 0.1] } },
      { t: 1.9, pose: {} },
    ],
    osc: (t) => ({ foreArmR: [0, 0, Math.sin(t * 11) * 0.3], handR: [0, 0, Math.sin(t * 11 + 0.7) * 0.15] }),
  },
  lean_forward: {
    duration: 1.6,
    keys: [{ t: 0, pose: {} }, { t: 0.4, pose: { spine: [0.14, 0, 0], chest: [0.1, 0, 0], head: [-0.06, 0, 0.05] } }, { t: 1.2, pose: { spine: [0.14, 0, 0], chest: [0.1, 0, 0], head: [-0.06, 0, 0.05] } }, { t: 1.6, pose: {} }],
  },
  shrug: {
    duration: 1.3,
    keys: [
      { t: 0, pose: {} },
      { t: 0.25, pose: { clavicleL: [0, 0, 0.22], clavicleR: [0, 0, -0.22], head: [0, 0, 0.1], upperArmL: [0, 0, 0.35], upperArmR: [0, 0, -0.35], foreArmL: [-0.5, 0, 0], foreArmR: [-0.5, 0, 0], handL: [0, 0, -0.3], handR: [0, 0, 0.3] } },
      { t: 0.9, pose: { clavicleL: [0, 0, 0.22], clavicleR: [0, 0, -0.22], head: [0, 0, 0.1], upperArmL: [0, 0, 0.35], upperArmR: [0, 0, -0.35], foreArmL: [-0.5, 0, 0], foreArmR: [-0.5, 0, 0], handL: [0, 0, -0.3], handR: [0, 0, 0.3] } },
      { t: 1.3, pose: {} },
    ],
  },
  think_chin: {
    duration: 2.6,
    keys: [
      { t: 0, pose: {} },
      { t: 0.5, pose: { upperArmR: [-0.3, 0, 0.1], foreArmR: [-2.9, 0, 0.55], handR: [-0.2, 0, 0.1], head: [0.08, 0.1, -0.06], chest: [0, 0.04, 0] } },
      { t: 2.1, pose: { upperArmR: [-0.3, 0, 0.1], foreArmR: [-2.9, 0, 0.55], handR: [-0.2, 0, 0.1], head: [0.08, 0.1, -0.06], chest: [0, 0.04, 0] } },
      { t: 2.6, pose: {} },
    ],
  },
  laugh: {
    duration: 1.8,
    keys: [{ t: 0, pose: {} }, { t: 0.2, pose: { head: [-0.12, 0, 0], chest: [-0.06, 0, 0] } }, { t: 1.5, pose: { head: [-0.12, 0, 0], chest: [-0.06, 0, 0] } }, { t: 1.8, pose: {} }],
    osc: (t) => ({ chest: [Math.sin(t * 22) * 0.03, 0, 0], head: [Math.sin(t * 22 + 1) * 0.03, 0, 0], clavicleL: [0, 0, Math.sin(t * 22) * 0.02], clavicleR: [0, 0, -Math.sin(t * 22) * 0.02] }),
  },
  point: {
    duration: 1.6,
    keys: [
      { t: 0, pose: {} },
      { t: 0.35, pose: { upperArmR: [-1.45, 0, 0.12], foreArmR: [-0.1, 0, 0], head: [0, -0.1, 0] } },
      { t: 1.2, pose: { upperArmR: [-1.45, 0, 0.12], foreArmR: [-0.1, 0, 0], head: [0, -0.1, 0] } },
      { t: 1.6, pose: {} },
    ],
  },
  scratch_head: {
    duration: 2.2,
    keys: [
      { t: 0, pose: {} },
      { t: 0.5, pose: { upperArmR: [-0.15, 0, -1.5], foreArmR: [0, 0, -2.5], handR: [0, 0, 0.3], head: [0.03, -0.08, 0.1] } },
      { t: 1.8, pose: { upperArmR: [-0.15, 0, -1.5], foreArmR: [0, 0, -2.5], handR: [0, 0, 0.3], head: [0.03, -0.08, 0.1] } },
      { t: 2.2, pose: {} },
    ],
    osc: (t) => ({ handR: [0, 0, Math.sin(t * 14) * 0.25] }),
  },
  facepalm: {
    duration: 2.0,
    keys: [
      { t: 0, pose: {} },
      { t: 0.5, pose: { upperArmL: [-0.35, 0, -0.08], foreArmL: [-2.9, 0, -0.55], head: [0.25, 0, 0.05], spine: [0.08, 0, 0] } },
      { t: 1.6, pose: { upperArmL: [-0.35, 0, -0.08], foreArmL: [-2.9, 0, -0.55], head: [0.25, 0, 0.05], spine: [0.08, 0, 0] } },
      { t: 2.0, pose: {} },
    ],
  },
  ready_stance: {
    duration: 2.0,
    keys: [
      { t: 0, pose: {} },
      { t: 0.35, pose: { hips: [0.1, 0, 0], spine: [0.1, 0, 0], thighL: [-0.3, 0, 0.18], thighR: [-0.3, 0, -0.18], shinL: [0.5, 0, 0], shinR: [0.5, 0, 0], upperArmL: [-0.5, 0, 0.35], upperArmR: [-0.5, 0, -0.35], foreArmL: [-1.1, 0, 0], foreArmR: [-1.1, 0, 0] } },
      { t: 1.6, pose: { hips: [0.1, 0, 0], spine: [0.1, 0, 0], thighL: [-0.3, 0, 0.18], thighR: [-0.3, 0, -0.18], shinL: [0.5, 0, 0], shinR: [0.5, 0, 0], upperArmL: [-0.5, 0, 0.35], upperArmR: [-0.5, 0, -0.35], foreArmL: [-1.1, 0, 0], foreArmR: [-1.1, 0, 0] } },
      { t: 2.0, pose: {} },
    ],
  },
}
void swayOsc

/** Idle variations (subtle life). */
export const IDLE_VARIATIONS: Gesture[] = [
  { duration: 3.2, keys: [{ t: 0, pose: {} }, { t: 0.8, pose: { hips: [0, 0, 0.03], thighL: [0, 0, 0.05], spine: [0, 0, -0.03], head: [0, 0, 0.03] } }, { t: 2.6, pose: { hips: [0, 0, 0.03], thighL: [0, 0, 0.05], spine: [0, 0, -0.03], head: [0, 0, 0.03] } }, { t: 3.2, pose: {} }] },
  { duration: 3.2, keys: [{ t: 0, pose: {} }, { t: 0.8, pose: { hips: [0, 0, -0.03], thighR: [0, 0, -0.05], spine: [0, 0, 0.03], head: [0, 0, -0.03] } }, { t: 2.6, pose: { hips: [0, 0, -0.03], thighR: [0, 0, -0.05], spine: [0, 0, 0.03], head: [0, 0, -0.03] } }, { t: 3.2, pose: {} }] },
  { duration: 2.0, keys: [{ t: 0, pose: {} }, { t: 0.4, pose: { clavicleL: [0, 0, 0.12], clavicleR: [0, 0, -0.12], head: [0.05, 0, 0] } }, { t: 0.9, pose: {} }, { t: 2.0, pose: {} }] },
  { duration: 3.0, keys: [{ t: 0, pose: {} }, { t: 0.7, pose: { head: [0.02, 0.1, 0.09], chest: [0, 0.04, 0] } }, { t: 2.3, pose: { head: [0.02, 0.1, 0.09], chest: [0, 0.04, 0] } }, { t: 3.0, pose: {} }] },
  { duration: 2.6, keys: [{ t: 0, pose: {} }, { t: 0.6, pose: { upperArmL: [0.1, 0, 0.08], foreArmL: [-0.3, 0, 0], handL: [0, 0.2, 0] } }, { t: 2.0, pose: { upperArmL: [0.1, 0, 0.08], foreArmL: [-0.3, 0, 0], handL: [0, 0.2, 0] } }, { t: 2.6, pose: {} }] },
]
