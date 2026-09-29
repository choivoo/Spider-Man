import { blankFace, VISEMES, VISEME_SHAPE, type FaceState, type Viseme } from './faceTypes'
import type { Emotion, FaceName } from '../ai/schema'
import { clamp } from './pose'

type Partial8 = Partial<Omit<FaceState, 'mouth' | 'visemes'>>

/** Emotion → face targets at intensity 1. */
const EMOTION_FACE: Record<Emotion, Partial8> = {
  neutral: {},
  happy: { Smile_L: 0.8, Smile_R: 0.8, BrowUp: 0.15, Squint: 0.25 },
  excited: { Smile_L: 0.95, Smile_R: 0.95, BrowUp: 0.55, MouthOpen: 0.22 },
  curious: { BrowUp: 0.4, Smile_L: 0.12, Smile_R: 0.25 },
  thinking: { BrowDown: 0.18, Squint: 0.12, Smile_R: 0.06 },
  embarrassed: { Smile_L: 0.55, Smile_R: 0.3, BrowUp: 0.35, Sad: 0.25, Squint: 0.1 },
  worried: { Sad: 0.55, BrowUp: 0.35 },
  sad: { Sad: 0.95, BrowUp: 0.1 },
  serious: { BrowDown: 0.4, Angry: 0.15 },
  surprised: { Surprise: 1, MouthOpen: 0.3 },
  confident: { Smile_L: 0.55, Smile_R: 0.3, BrowUp: 0.12, Squint: 0.1 },
  focused: { BrowDown: 0.3, Squint: 0.28 },
}
const FACE_PRESET: Record<FaceName, Partial8> = {
  neutral: {},
  smile: EMOTION_FACE.happy,
  laugh: { Smile_L: 1, Smile_R: 1, Squint: 0.55, MouthOpen: 0.55, BrowUp: 0.2 },
  curious: EMOTION_FACE.curious,
  confused: { BrowUp: 0.3, Sad: 0.2, Smile_R: 0.1, BrowDown: 0.1 },
  embarrassed: EMOTION_FACE.embarrassed,
  surprised: EMOTION_FACE.surprised,
  serious: EMOTION_FACE.serious,
  worried: EMOTION_FACE.worried,
  sad: EMOTION_FACE.sad,
}

const KEYS: (keyof Partial8)[] = ['Smile_L', 'Smile_R', 'MouthOpen', 'BrowUp', 'BrowDown', 'Surprise', 'Angry', 'Sad', 'Squint']

export class FaceController {
  state: FaceState = blankFace()
  private target: Partial8 = {}
  private blinkTimer = 2
  private blinkT = -1
  private doubleBlink = false
  private lastEmotion: Emotion = 'neutral'
  /** externally forced expression override (e.g. suit eyes) */
  private speakingViseme: { viseme: Viseme; weight: number } | null = null
  private vTarget: Record<Viseme, number> = { ...blankFace().visemes }
  blinkSuppress = 0 // >0 while the eyes are "masked" etc.
  reducedMotion = false

  setEmotion(emotion: Emotion, intensity: number, face?: FaceName) {
    this.lastEmotion = emotion
    const base = { ...EMOTION_FACE[emotion] }
    const t: Partial8 = {}
    const src = face && face !== 'neutral' ? FACE_PRESET[face] : base
    const k = clamp(intensity * 1.15, 0, 1.1)
    for (const key of KEYS) t[key] = (src[key] ?? 0) * (face && face !== 'neutral' ? Math.max(k, 0.5) : k)
    this.target = t
  }

  setViseme(v: { viseme: Viseme; weight: number } | null) { this.speakingViseme = v }

  blinkNow() { if (this.blinkT < 0) this.blinkT = 0 }

  update(dt: number, opts: { talking: boolean; lookAwayBlink?: boolean }) {
    const S = this.state
    // --- blink scheduler
    this.blinkTimer -= dt
    if (this.blinkT < 0 && this.blinkTimer <= 0) {
      this.blinkT = 0
      this.doubleBlink = Math.random() < 0.18
      this.blinkTimer = 2.2 + Math.random() * 3.8 - (this.lastEmotion === 'worried' ? 1 : 0)
    }
    let blink = 0
    if (this.blinkT >= 0) {
      this.blinkT += dt
      const d = 0.16
      const p = this.blinkT / d
      blink = p < 0.4 ? p / 0.4 : Math.max(0, 1 - (p - 0.4) / 0.6)
      if (this.blinkT > d) {
        if (this.doubleBlink) { this.doubleBlink = false; this.blinkT = 0.02 } else this.blinkT = -1
      }
    }
    // --- smoothed expression channels
    const kExp = 1 - Math.exp(-dt * 7)
    for (const key of KEYS) {
      const tgt = this.target[key] ?? 0
      S[key] += (tgt - S[key]) * kExp
    }
    // subtle micro-expression noise for life
    const n = this.reducedMotion ? 0 : 1
    const now = performance.now() / 1000
    S.BrowUp += 0 * n * Math.sin(now)
    S.Blink_L = blink; S.Blink_R = blink * (this.blinkT > 0 && Math.random() < 0.0 ? 0.9 : 1)

    // --- visemes (fast smoothing)
    for (const v of VISEMES) this.vTarget[v] = 0
    if (this.speakingViseme) this.vTarget[this.speakingViseme.viseme] = this.speakingViseme.weight
    else this.vTarget.REST = 1
    const kV = 1 - Math.exp(-dt * 26)
    for (const v of VISEMES) S.visemes[v] += (this.vTarget[v] - S.visemes[v]) * kV
    let open = 0, width = 0, round = 0, fv = 0, wsum = 0
    for (const v of VISEMES) {
      const w = S.visemes[v]; if (v === 'REST') continue
      const sh = VISEME_SHAPE[v]
      open += w * sh.open; round += w * sh.round; fv += w * (sh.fv ?? 0)
      width += w * (sh.width - 1); wsum += w
    }
    void wsum
    S.mouth.open = clamp(open, 0, 1)
    S.mouth.width = 1 + width
    S.mouth.round = clamp(round, 0, 1)
    S.mouth.fv = clamp(fv, 0, 1)
    void opts
    return S
  }
}
