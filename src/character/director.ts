import * as THREE from 'three'
import type { CharacterResponse, Emotion, Gesture, EyeExpression } from '../ai/schema'
import type { Rig } from './ProceduralRig'
import { AnimationController } from '../animation/AnimationController'
import { FaceController } from '../animation/FaceController'
import { LookAtController } from '../animation/LookAtController'
import { LipSyncPlayer, estimateDuration } from '../animation/LipSync'
import { useCharacterStore } from '../store/characterStore'

/**
 * Director: imperative façade over all character systems so non-React code (AI pipeline, hotkeys,
 * voice, transformation) can drive the character without knowing about the scene graph.
 */
class Director {
  anim: AnimationController | null = null
  face = new FaceController()
  look = new LookAtController()
  lip = new LipSyncPlayer()
  eyeExpression: EyeExpression = 'normal'
  private speechEndAt = 0
  /** set true while TTS audio drives timing; the lip player then follows boundary events */
  externalTiming = false
  onResponseActions: ((r: CharacterResponse) => void) | null = null
  reducedMotion = false

  attachRig(rig: Rig) { this.anim = new AnimationController(rig); this.anim.reducedMotion = this.reducedMotion }
  detachRig() { this.anim = null }

  setReducedMotion(v: boolean) {
    this.reducedMotion = v
    this.face.reducedMotion = v
    this.look.reducedMotion = v
    if (this.anim) this.anim.reducedMotion = v
  }

  get talking() { return this.lip.playing || this.externalTiming }

  setEmotion(e: Emotion, i: number, face?: CharacterResponse['face']) {
    this.anim?.setEmotion(e, i)
    this.face.setEmotion(e, i, face)
    useCharacterStore.getState().setEmotion(e, i)
  }

  gesture(g: Gesture | string) { this.anim?.play(g) }

  /** begin speaking `text`; duration optional (seconds). Returns estimated duration. */
  beginSpeech(text: string, opts: { duration?: number; external?: boolean } = {}) {
    const dur = opts.duration ?? estimateDuration(text)
    this.lip.start(text, dur)
    this.externalTiming = !!opts.external
    this.speechEndAt = performance.now() + dur * 1000 + 400
    useCharacterStore.getState().setSpeaking(true)
    return dur
  }
  endSpeech() {
    this.lip.stop(); this.externalTiming = false
    useCharacterStore.getState().setSpeaking(false)
  }

  perform(r: CharacterResponse) {
    this.setEmotion(r.emotion, r.emotionIntensity, r.face)
    this.eyeExpression = r.eyeExpression
    if (r.gesture !== 'none') this.gesture(r.gesture)
    if (!r.lookAtUser) this.look.lookAwayFor(1.2 + Math.random())
    this.onResponseActions?.(r)
  }

  /** called each frame by <Character/> */
  update(dt: number, cam: THREE.Camera) {
    if (!this.anim) return
    const talking = this.talking
    // lip-sync → face
    const v = this.lip.tick(dt)
    this.face.setViseme(v && v.viseme !== 'REST' ? v : v ? { viseme: 'REST', weight: 1 } : null)
    if (this.lip.playing === false && !this.externalTiming) {
      const st = useCharacterStore.getState()
      if (st.speaking && performance.now() > this.speechEndAt) st.setSpeaking(false)
    }
    this.anim.setTalking(talking ? 1 : 0)
    // look-at
    const rig = this.anim.rig
    const headW = new THREE.Vector3(); rig.bones.head.getWorldPosition(headW)
    const rootQ = new THREE.Quaternion(); rig.root.getWorldQuaternion(rootQ)
    const lo = this.look.update(dt, cam, headW, rootQ, talking)
    this.face.update(dt, { talking })
    this.anim.update(dt, lo)
  }
}

export const director = new Director()
