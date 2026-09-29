import { SUIT_PARTS, type SuitPartName } from '../character/rigSpec'
import {
  SUIT_UP_DURATION, SUIT_UP_WINDOWS, SUIT_UP_KEYS, SUIT_DOWN_DURATION, SUIT_DOWN_WINDOWS, SUIT_DOWN_KEYS,
  MASK_DURATION, ARMS_DEPLOY_DURATION, ARMS_RETRACT_DURATION, window01, smooth01,
} from './timeline'

export type Form = 'CIVILIAN' | 'SPIDER'
export type Phase = 'IDLE' | 'SUIT_UP' | 'SUIT_DOWN'
export type MaskState = 'MASK_OPEN' | 'MASK_CLOSING' | 'MASK_CLOSED' | 'MASK_OPENING'
export type ArmsState = 'ARMS_RETRACTED' | 'ARMS_DEPLOYING' | 'ARMS_DEPLOYED' | 'ARMS_RETRACTING'
export type ArmsMode = 'IDLE' | 'DEFENSE' | 'ATTACK' | 'BALANCE' | 'POSE'

export type Command =
  | 'SUIT_TOGGLE' | 'SUIT_UP' | 'SUIT_DOWN'
  | 'MASK_TOGGLE' | 'MASK_OPEN' | 'MASK_CLOSE'
  | 'ARMS_TOGGLE' | 'ARMS_DEPLOY' | 'ARMS_RETRACT'
export type DispatchResult = 'accepted' | 'queued' | 'ignored'

export type TransformEvent =
  | 'suitUpStart' | 'core' | 'particles' | 'chestArmor' | 'maskForm' | 'maskClose' | 'eyes' | 'emblem' | 'suitUpComplete'
  | 'suitDownStart' | 'recall' | 'chestFlash' | 'suitDownComplete'
  | 'maskOpenStart' | 'maskOpenDone' | 'maskCloseStart' | 'maskCloseDone'
  | 'armsDeployStart' | 'armsDeployDone' | 'armsRetractStart' | 'armsRetractDone'

/** Spec §38 state labels. */
export type StateLabel =
  | 'CIVILIAN_IDLE' | 'CIVILIAN_TALK' | 'SUIT_UP' | 'SPIDER_IDLE' | 'SPIDER_TALK'
  | 'MASK_OPEN' | 'MASK_CLOSE' | 'ARMS_DEPLOY' | 'ARMS_RETRACT' | 'SUIT_DOWN'

const zeroParts = (v = 0) => Object.fromEntries(SUIT_PARTS.map((p) => [p, v])) as Record<SuitPartName, number>

/**
 * Pure, time-driven transformation state machine + timeline. No rendering, no DOM — fully unit-testable.
 * Rendering reads `progress` (per suit region, 0→1), `mask`, `arms*`, glow scalars, and listens to events.
 */
export class NanotechController {
  form: Form = 'CIVILIAN'
  phase: Phase = 'IDLE'
  mask: MaskState = 'MASK_OPEN'
  arms: ArmsState = 'ARMS_RETRACTED'
  armsMode: ArmsMode = 'IDLE'

  /** 0 = civilian, 1 = suit, per region (Head = mask) */
  progress: Record<SuitPartName, number> = zeroParts(0)
  /** head shader: 0 = jaw→forehead ordering (opening), 1 = sides→centre (closing) */
  headMix = 1
  armsProgress = 0
  core = 0        // chest nano-core glow
  eyes = 0        // spider eyes glow
  emblem = 0      // emblem activation
  flow = 0        // particle activity 0..1
  flowDir: 1 | -1 = 1
  /** overall 0 (civilian) → 1 (spider) for UI/lighting blends */
  formBlend = 0
  speed = 1
  lastTransformAt = 0

  private t = 0
  private maskT = 0
  private armsT = 0
  private queue: Command[] = []
  private fired = new Set<TransformEvent>()
  private listeners = new Map<TransformEvent, Set<() => void>>()
  private anyListeners = new Set<(e: TransformEvent) => void>()
  private now = 0
  /** debug: hold the timeline still (used by visual QA) */
  frozen = false

  on(e: TransformEvent, fn: () => void) {
    if (!this.listeners.has(e)) this.listeners.set(e, new Set())
    this.listeners.get(e)!.add(fn)
    return () => this.listeners.get(e)?.delete(fn)
  }
  onAny(fn: (e: TransformEvent) => void) { this.anyListeners.add(fn); return () => this.anyListeners.delete(fn) }
  private emit(e: TransformEvent) {
    if (this.fired.has(e)) return
    this.fired.add(e)
    this.listeners.get(e)?.forEach((f) => f())
    this.anyListeners.forEach((f) => f(e))
  }
  private emitAlways(e: TransformEvent) {
    this.listeners.get(e)?.forEach((f) => f())
    this.anyListeners.forEach((f) => f(e))
  }

  get transforming() { return this.phase !== 'IDLE' }
  get busy() {
    return this.phase !== 'IDLE' || this.mask === 'MASK_CLOSING' || this.mask === 'MASK_OPENING' ||
      this.arms === 'ARMS_DEPLOYING' || this.arms === 'ARMS_RETRACTING'
  }
  get queued(): readonly Command[] { return this.queue }
  get maskOpen() { return this.form === 'CIVILIAN' || this.mask === 'MASK_OPEN' || this.mask === 'MASK_OPENING' }
  get armsDeployed() { return this.arms === 'ARMS_DEPLOYED' || this.arms === 'ARMS_DEPLOYING' }

  label(talking = false): StateLabel {
    if (this.phase === 'SUIT_UP') return 'SUIT_UP'
    if (this.phase === 'SUIT_DOWN') return 'SUIT_DOWN'
    if (this.mask === 'MASK_OPENING') return 'MASK_OPEN'
    if (this.mask === 'MASK_CLOSING') return 'MASK_CLOSE'
    if (this.arms === 'ARMS_DEPLOYING') return 'ARMS_DEPLOY'
    if (this.arms === 'ARMS_RETRACTING') return 'ARMS_RETRACT'
    if (this.form === 'SPIDER') return talking ? 'SPIDER_TALK' : 'SPIDER_IDLE'
    return talking ? 'CIVILIAN_TALK' : 'CIVILIAN_IDLE'
  }

  /** Conflict-safe command entry point. */
  dispatch(cmd: Command): DispatchResult {
    switch (cmd) {
      case 'SUIT_TOGGLE':
        if (this.transforming) return 'ignored'
        return this.dispatch(this.form === 'CIVILIAN' ? 'SUIT_UP' : 'SUIT_DOWN')
      case 'SUIT_UP':
        if (this.transforming || this.form !== 'CIVILIAN') return 'ignored'
        this.startSuitUp(); return 'accepted'
      case 'SUIT_DOWN':
        if (this.transforming || this.form !== 'SPIDER') return 'ignored'
        if (this.mask === 'MASK_CLOSING' || this.mask === 'MASK_OPENING' || this.arms === 'ARMS_DEPLOYING' || this.arms === 'ARMS_RETRACTING') return this.enqueue('SUIT_DOWN')
        if (this.arms === 'ARMS_DEPLOYED') { this.startArms(false); return this.enqueue('SUIT_DOWN') === 'queued' ? 'accepted' : 'accepted' }
        this.startSuitDown(); return 'accepted'
      case 'MASK_TOGGLE':
        if (this.form !== 'SPIDER') return 'ignored'
        if (this.transforming) return 'ignored'
        if (this.mask === 'MASK_CLOSED') return this.dispatch('MASK_OPEN')
        if (this.mask === 'MASK_OPEN') return this.dispatch('MASK_CLOSE')
        return this.enqueue(cmd)
      case 'MASK_OPEN':
        if (this.form !== 'SPIDER' || this.transforming) return 'ignored'
        if (this.mask === 'MASK_CLOSED') { this.startMask(false); return 'accepted' }
        if (this.mask === 'MASK_CLOSING') return this.enqueue(cmd)
        return 'ignored'
      case 'MASK_CLOSE':
        if (this.form !== 'SPIDER' || this.transforming) return 'ignored'
        if (this.mask === 'MASK_OPEN') { this.startMask(true); return 'accepted' }
        if (this.mask === 'MASK_OPENING') return this.enqueue(cmd)
        return 'ignored'
      case 'ARMS_TOGGLE':
        if (this.form !== 'SPIDER' || this.transforming) return 'ignored'
        if (this.arms === 'ARMS_RETRACTED') return this.dispatch('ARMS_DEPLOY')
        if (this.arms === 'ARMS_DEPLOYED') return this.dispatch('ARMS_RETRACT')
        return this.enqueue(cmd)
      case 'ARMS_DEPLOY':
        if (this.form !== 'SPIDER' || this.transforming) return 'ignored'
        if (this.arms === 'ARMS_RETRACTED') { this.startArms(true); return 'accepted' }
        if (this.arms === 'ARMS_RETRACTING') return this.enqueue(cmd)
        return 'ignored'
      case 'ARMS_RETRACT':
        if (this.form !== 'SPIDER' || this.transforming) return 'ignored'
        if (this.arms === 'ARMS_DEPLOYED') { this.startArms(false); return 'accepted' }
        if (this.arms === 'ARMS_DEPLOYING') return this.enqueue(cmd)
        return 'ignored'
    }
  }

  private enqueue(cmd: Command): DispatchResult {
    if (this.queue.includes(cmd) || this.queue.length >= 2) return 'ignored'
    this.queue.push(cmd)
    return 'queued'
  }
  private drain() {
    if (this.busy) return
    const next = this.queue.shift()
    if (next) this.dispatch(next)
  }

  setArmsMode(m: ArmsMode) { if (this.arms === 'ARMS_DEPLOYED') this.armsMode = m }

  private startSuitUp() {
    this.phase = 'SUIT_UP'; this.t = 0; this.fired.clear()
    this.headMix = 1; this.flowDir = 1
    this.emitAlways('suitUpStart')
  }
  private startSuitDown() {
    this.phase = 'SUIT_DOWN'; this.t = 0; this.fired.clear()
    this.headMix = 0; this.flowDir = -1
    this.emitAlways('suitDownStart')
  }
  private startMask(close: boolean) {
    this.mask = close ? 'MASK_CLOSING' : 'MASK_OPENING'
    this.maskT = 0; this.headMix = close ? 1 : 0
    this.emitAlways(close ? 'maskCloseStart' : 'maskOpenStart')
  }
  private startArms(deploy: boolean) {
    this.arms = deploy ? 'ARMS_DEPLOYING' : 'ARMS_RETRACTING'
    this.armsT = 0
    this.emitAlways(deploy ? 'armsDeployStart' : 'armsRetractStart')
  }

  /** Advance simulation. `dt` in seconds (clamped). */
  update(dt: number) {
    dt = this.frozen ? 0 : Math.min(Math.max(dt, 0), 0.1) * this.speed
    this.now += dt

    if (this.phase === 'SUIT_UP') {
      this.t += dt
      const t = this.t
      for (const p of SUIT_PARTS) this.progress[p] = window01(t, SUIT_UP_WINDOWS[p])
      const K = SUIT_UP_KEYS
      this.core = t < K.core ? 0 : Math.min(1, smooth01((t - K.core) / 0.25)) * (t > K.complete - 0.3 ? 1 - smooth01((t - (K.complete - 0.3)) / 0.3) * 0.7 : 1)
      this.flow = t < K.particles ? 0 : t > 2.05 ? 1 - smooth01((t - 2.05) / 0.4) : 1
      this.eyes = smooth01((t - K.eyes) / 0.15)
      this.emblem = smooth01((t - K.emblem) / 0.15)
      this.formBlend = smooth01(t / SUIT_UP_DURATION)
      if (t >= K.core) this.emit('core')
      if (t >= K.particles) this.emit('particles')
      if (t >= K.chestArmor) this.emit('chestArmor')
      if (t >= K.maskForm) this.emit('maskForm')
      if (t >= K.maskClose) this.emit('maskClose')
      if (t >= K.eyes) this.emit('eyes')
      if (t >= K.emblem) this.emit('emblem')
      if (t >= SUIT_UP_DURATION) {
        for (const p of SUIT_PARTS) this.progress[p] = 1
        this.phase = 'IDLE'; this.form = 'SPIDER'; this.mask = 'MASK_CLOSED'
        this.core = 0; this.eyes = 1; this.emblem = 1; this.flow = 0; this.formBlend = 1
        this.lastTransformAt = Date.now()
        this.emitAlways('suitUpComplete')
      }
    } else if (this.phase === 'SUIT_DOWN') {
      this.t += dt
      const t = this.t
      const maskWasOpen = this.mask === 'MASK_OPEN'
      for (const p of SUIT_PARTS) {
        if (p === 'Head' && maskWasOpen) { this.progress[p] = 0; continue }
        this.progress[p] = 1 - window01(t, SUIT_DOWN_WINDOWS[p])
      }
      this.eyes = 1 - smooth01(t / 0.2)
      this.emblem = 1 - smooth01((t - 0.9) / 0.3)
      this.arms = 'ARMS_RETRACTED'; this.armsProgress = 0
      this.flow = t < 0.3 ? smooth01(t / 0.3) : t > 1.9 ? 1 - smooth01((t - 1.9) / 0.25) : 1
      this.core = t < 0.5 ? 0 : smooth01((t - 0.5) / 1.3) * 0.9 - (t > SUIT_DOWN_KEYS.chestFlash ? smooth01((t - SUIT_DOWN_KEYS.chestFlash) / 0.25) * 0.9 : 0)
      this.formBlend = 1 - smooth01(t / SUIT_DOWN_DURATION)
      if (t >= SUIT_DOWN_KEYS.recall) this.emit('recall')
      if (t >= SUIT_DOWN_KEYS.chestFlash) this.emit('chestFlash')
      if (t >= SUIT_DOWN_DURATION) {
        for (const p of SUIT_PARTS) this.progress[p] = 0
        this.phase = 'IDLE'; this.form = 'CIVILIAN'; this.mask = 'MASK_OPEN'
        this.core = 0; this.eyes = 0; this.emblem = 0; this.flow = 0; this.formBlend = 0
        this.lastTransformAt = Date.now()
        this.emitAlways('suitDownComplete')
      }
    } else {
      // steady state values
      this.core += (0 - this.core) * Math.min(1, dt * 3)
      this.flow = 0
    }

    // mask (only outside a suit transition)
    if (this.phase === 'IDLE' && this.form === 'SPIDER') {
      if (this.mask === 'MASK_CLOSING') {
        this.maskT += dt
        this.progress.Head = smooth01(this.maskT / MASK_DURATION)
        this.eyes = smooth01((this.maskT - MASK_DURATION * 0.6) / 0.25)
        if (this.maskT >= MASK_DURATION) { this.progress.Head = 1; this.mask = 'MASK_CLOSED'; this.eyes = 1; this.emitAlways('maskCloseDone') }
      } else if (this.mask === 'MASK_OPENING') {
        this.maskT += dt
        this.progress.Head = 1 - smooth01(this.maskT / MASK_DURATION)
        this.eyes = 1 - smooth01(this.maskT / 0.25)
        if (this.maskT >= MASK_DURATION) { this.progress.Head = 0; this.mask = 'MASK_OPEN'; this.eyes = 0; this.emitAlways('maskOpenDone') }
      }
      // arms
      if (this.arms === 'ARMS_DEPLOYING') {
        this.armsT += dt
        this.armsProgress = smooth01(this.armsT / ARMS_DEPLOY_DURATION)
        if (this.armsT >= ARMS_DEPLOY_DURATION) { this.armsProgress = 1; this.arms = 'ARMS_DEPLOYED'; this.armsMode = 'IDLE'; this.emitAlways('armsDeployDone') }
      } else if (this.arms === 'ARMS_RETRACTING') {
        this.armsT += dt
        this.armsProgress = 1 - smooth01(this.armsT / ARMS_RETRACT_DURATION)
        if (this.armsT >= ARMS_RETRACT_DURATION) { this.armsProgress = 0; this.arms = 'ARMS_RETRACTED'; this.armsMode = 'IDLE'; this.emitAlways('armsRetractDone') }
      }
    }
    this.drain()
  }

  /** Debug/QA: jump into the middle of a transformation and hold there. */
  scrub(kind: 'up' | 'down' | null, t = 0) {
    if (kind === null) { this.frozen = false; return }
    this.reset(kind === 'up' ? 'CIVILIAN' : 'SPIDER')
    this.phase = kind === 'up' ? 'SUIT_UP' : 'SUIT_DOWN'
    this.headMix = kind === 'up' ? 1 : 0; this.flowDir = kind === 'up' ? 1 : -1
    this.t = t; this.frozen = true
    this.update(0.0001)
  }

  /** Hard reset (error recovery). */
  reset(form: Form = 'CIVILIAN') {
    this.phase = 'IDLE'; this.form = form; this.queue.length = 0; this.fired.clear()
    const v = form === 'SPIDER' ? 1 : 0
    for (const p of SUIT_PARTS) this.progress[p] = v
    this.mask = form === 'SPIDER' ? 'MASK_CLOSED' : 'MASK_OPEN'
    this.arms = 'ARMS_RETRACTED'; this.armsProgress = 0; this.armsMode = 'IDLE'
    this.core = 0; this.eyes = v; this.emblem = v; this.flow = 0; this.formBlend = v
  }
}
