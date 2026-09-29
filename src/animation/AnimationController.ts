import * as THREE from 'three'
import { BONES, type BoneName } from '../character/rigSpec'
import type { Rig } from '../character/ProceduralRig'
import { STANCE_CIVILIAN, STANCE_SPIDER, HOLD_POSES, GESTURES, EXTRA_GESTURES, IDLE_VARIATIONS } from './poses'
import { sampleGesture, lerp, clamp, type Gesture, type Pose, type V3 } from './pose'
import type { Emotion } from '../ai/schema'
import type { LookOutput } from './LookAtController'

interface Spring { p: V3; v: V3 }

const z3 = (): V3 => [0, 0, 0]
/** cheap smooth pseudo-noise in [-1,1] */
const wob = (t: number, a: number, b: number, c: number) => (Math.sin(t * a) * 0.5 + Math.sin(t * b + 1.7) * 0.3 + Math.sin(t * c + 4.1) * 0.2)

const EMOTION_POSTURE: Partial<Record<Emotion, Pose>> = {
  worried: { head: [0.1, 0, 0.03], chest: [0.04, 0, 0], clavicleL: [0, 0, 0.06], clavicleR: [0, 0, -0.06] },
  sad: { head: [0.16, 0, 0.03], chest: [0.07, 0, 0], spine: [0.05, 0, 0], clavicleL: [0, 0, -0.03], clavicleR: [0, 0, 0.03] },
  confident: { chest: [-0.04, 0, 0], head: [-0.02, 0, 0], clavicleL: [0, 0, -0.04], clavicleR: [0, 0, 0.04] },
  excited: { chest: [-0.03, 0, 0], head: [-0.03, 0, 0] },
  embarrassed: { head: [0.1, 0, 0.09], clavicleL: [0, 0, 0.08], clavicleR: [0, 0, -0.08], chest: [0.03, 0, 0] },
  surprised: { chest: [-0.05, 0, 0], head: [-0.06, 0, 0], upperArmL: [0, 0, 0.12], upperArmR: [0, 0, -0.12] },
  thinking: { head: [0.02, 0.06, 0.05] },
  serious: { head: [0.03, 0, 0], chest: [-0.02, 0, 0] },
  focused: { head: [0.04, 0, 0], spine: [0.03, 0, 0] },
}

export class AnimationController {
  private spring = {} as Record<BoneName, Spring>
  stanceBlend = 0 // 0 civilian → 1 spider
  private stanceTarget = 0
  private holdName: string | null = null
  private holdW = 0
  private gesture: { def: Gesture; t: number; name: string } | null = null
  private idle: { def: Gesture; t: number } | null = null
  private idleTimer = 5
  emotion: Emotion = 'neutral'
  emotionIntensity = 0.3
  talk = 0
  private talkTarget = 0
  energy = 0.6
  stress = 0.15
  reducedMotion = false
  time = 0
  /** debug: freeze a gesture at t */
  private frozen: { name: string; t: number } | null = null
  /** vertical correction so the lowest foot stays on the floor */
  private footCorr = 0
  hipsOffset: V3 = z3()
  /** extra additive pose from other systems (spider arms braces, etc.) */
  extra: Pose = {}
  private qTmp = new THREE.Quaternion()
  private eTmp = new THREE.Euler()
  private vTmp = new THREE.Vector3()

  constructor(public rig: Rig) {
    for (const b of BONES) this.spring[b] = { p: z3(), v: z3() }
  }

  setStance(s: 'civilian' | 'spider') { this.stanceTarget = s === 'spider' ? 1 : 0 }
  setEmotion(e: Emotion, i: number) { this.emotion = e; this.emotionIntensity = i }
  setTalking(a: number) { this.talkTarget = a }
  get activeGesture() { return this.gesture?.name ?? null }
  get holding() { return this.holdName }

  play(name: string) {
    if (name === 'none') return
    if (name in HOLD_POSES) { this.holdName = this.holdName === name ? null : name; return }
    const def = (GESTURES as Record<string, Gesture>)[name] ?? EXTRA_GESTURES[name]
    if (def) this.gesture = { def, t: 0, name }
  }
  release() { this.holdName = null }
  freeze(name: string | null, t = 0.8) { this.frozen = name ? { name, t } : null }

  update(dt: number, look: LookOutput) {
    dt = Math.min(dt, 0.05)
    this.time += dt
    const t = this.time
    this.stanceBlend += (this.stanceTarget - this.stanceBlend) * (1 - Math.exp(-dt * 4))
    this.talk += (this.talkTarget - this.talk) * (1 - Math.exp(-dt * 6))
    const rm = this.reducedMotion ? 0.35 : 1

    const target: Record<BoneName, V3> = {} as Record<BoneName, V3>
    for (const b of BONES) target[b] = z3()
    const add = (p: Pose | undefined, k = 1) => {
      if (!p) return
      for (const b of Object.keys(p) as BoneName[]) { const v = p[b]!; const T = target[b]; T[0] += v[0] * k; T[1] += v[1] * k; T[2] += v[2] * k }
    }
    // stance
    add(STANCE_CIVILIAN, 1 - this.stanceBlend)
    add(STANCE_SPIDER, this.stanceBlend)
    // breathing (rate follows energy/stress)
    const br = Math.sin(t * (1.35 + this.stress * 0.9)) * (0.011 + this.stress * 0.006) * rm
    target.chest[0] += br; target.spine[0] += br * 0.4
    target.clavicleL[2] += br * 1.4; target.clavicleR[2] -= br * 1.4
    target.head[0] -= br * 0.6
    // slow body sway
    target.hips[2] += Math.sin(t * 0.37) * 0.008 * rm
    target.spine[2] -= Math.sin(t * 0.37) * 0.012 * rm
    target.head[1] += wob(t, 0.31, 0.53, 0.97) * 0.02 * rm
    // emotion posture
    const ep = EMOTION_POSTURE[this.emotion]
    add(ep, this.emotionIntensity * rm * 1.1)

    // idle variation scheduler
    if (!this.gesture && this.talk < 0.2) {
      this.idleTimer -= dt
      if (this.idleTimer <= 0 && !this.idle && !this.reducedMotion) {
        this.idle = { def: IDLE_VARIATIONS[Math.floor(Math.random() * IDLE_VARIATIONS.length)], t: 0 }
        this.idleTimer = 6 + Math.random() * 10
      }
    }
    const applyGesture = (g: Gesture, gt: number, k = 1) => {
      const s = sampleGesture(g, gt)
      for (const b of Object.keys(s) as BoneName[]) {
        const e = s[b]!
        const T = target[b], w = e.w * k
        T[0] = lerp(T[0], e.v[0], w); T[1] = lerp(T[1], e.v[1], w); T[2] = lerp(T[2], e.v[2], w)
      }
    }
    if (this.idle) {
      this.idle.t += dt
      if (this.idle.t >= this.idle.def.duration) this.idle = null
      else applyGesture(this.idle.def, this.idle.t, 0.9 * rm)
    }

    // hold pose (hands in pocket / cross arms) with eased weight
    const holdWant = this.holdName ? 1 : 0
    this.holdW += (holdWant - this.holdW) * (1 - Math.exp(-dt * 4.5))
    const hp = this.holdName ? HOLD_POSES[this.holdName] : this.lastHold
    if (this.holdName) this.lastHold = HOLD_POSES[this.holdName]
    if (hp && this.holdW > 0.002) {
      for (const b of Object.keys(hp) as BoneName[]) {
        const v = hp[b]!, T = target[b]
        T[0] = lerp(T[0], v[0], this.holdW); T[1] = lerp(T[1], v[1], this.holdW); T[2] = lerp(T[2], v[2], this.holdW)
      }
    }

    // talking beats (arms only when free)
    if (this.talk > 0.02) {
      const k = this.talk * (0.6 + this.energy * 0.6) * rm
      target.head[0] += wob(t, 2.3, 3.7, 5.1) * 0.05 * k
      target.head[1] += wob(t, 1.7, 2.9, 4.3) * 0.06 * k
      target.head[2] += wob(t, 1.1, 2.1, 3.3) * 0.04 * k
      target.chest[1] += wob(t, 1.3, 2.2, 3.1) * 0.03 * k
      if (this.holdW < 0.5 && !this.gesture) {
        const a = Math.max(0, wob(t, 1.9, 2.7, 4.1) + 0.3), b2 = Math.max(0, wob(t, 1.5, 3.1, 4.7) + 0.2)
        target.upperArmR[0] -= a * 0.32 * k; target.foreArmR[0] -= a * 0.75 * k; target.handR[0] -= a * 0.2 * k
        target.upperArmL[0] -= b2 * 0.22 * k; target.foreArmL[0] -= b2 * 0.55 * k
        target.upperArmR[2] -= a * 0.08 * k
      }
    }

    // explicit gesture
    if (this.frozen) {
      const g = (GESTURES as Record<string, Gesture>)[this.frozen.name] ?? EXTRA_GESTURES[this.frozen.name]
      if (g) applyGesture(g, this.frozen.t)
    } else if (this.gesture) {
      this.gesture.t += dt
      if (this.gesture.t >= this.gesture.def.duration) this.gesture = null
      else applyGesture(this.gesture.def, this.gesture.t)
    }

    // extra layer + look-at
    add(this.extra)
    target.head[1] += look.yaw * 0.85; target.head[0] -= look.pitch * 0.9
    target.neck[1] += look.yaw * 0.3; target.neck[0] -= look.pitch * 0.3
    target.chest[1] += look.yaw * 0.12

    // springs → bones
    const w0 = 15, zeta = 1.0
    for (const b of BONES) {
      const S = this.spring[b], T = target[b]
      for (let i = 0; i < 3; i++) {
        const acc = w0 * w0 * (T[i] - S.p[i]) - 2 * zeta * w0 * S.v[i]
        S.v[i] += acc * dt
        S.p[i] += S.v[i] * dt
      }
      this.eTmp.set(S.p[0], S.p[1], S.p[2], 'XYZ')
      this.qTmp.setFromEuler(this.eTmp)
      const bone = this.rig.bones[b]
      bone.quaternion.copy(this.rig.restQuat[b]).multiply(this.qTmp)
    }
    // hips motion + foot plant
    const hips = this.rig.bones.hips
    hips.position.copy(this.rig.restPos.hips)
    hips.position.x += this.hipsOffset[0]; hips.position.z += this.hipsOffset[2]
    hips.position.y += this.hipsOffset[1] + this.footCorr + Math.sin(t * 1.35) * 0.0015
    this.rig.root.updateMatrixWorld(true)
    let lowest = Infinity
    for (const f of ['footL', 'footR'] as const) {
      this.rig.bones[f].getWorldPosition(this.vTmp)
      lowest = Math.min(lowest, this.vTmp.y - 0.075)
    }
    const rootY = this.rig.root.position.y
    this.footCorr += clamp(-(lowest - rootY), -0.2, 0.2) * (1 - Math.exp(-dt * 12))
  }
  private lastHold: Pose | null = null
}
